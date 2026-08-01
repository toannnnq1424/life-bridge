package org.lifebridge.community;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

@Service
public class CommunityModerationService {
  private static final Set<String> OUTCOMES=Set.of("no_change","content_visibility_restricted","community_participation_restricted");
  private static final Set<String> REASONS=Set.of("insufficient_authoritative_evidence","duplicate_report","outside_moderation_scope","policy_content_boundary","policy_privacy_boundary","policy_contact_boundary");
  private final JdbcTemplate jdbc; private final ObjectMapper mapper;
  public CommunityModerationService(JdbcTemplate jdbc,ObjectMapper mapper){this.jdbc=jdbc;this.mapper=mapper;}

  @Transactional
  public Result queue(Map<String,Object> body,String correlation){
    Auth auth=authorize(body,"community_moderation.queue.read","/internal/v1/community/moderation/cases/query"); enrollment(auth.actor());
    List<Map<String,Object>> items=jdbc.query("SELECT case_id,state,evidence_category,provenance,redaction_state,policy_version,version,reported_at,expires_at FROM community_moderation_cases WHERE state='open' ORDER BY reported_at,case_id LIMIT 25",
      (r,n)->projection(r)); audit("moderation.queue_read",CommunityDigest.sha256("queue"),1,auth.actor(),correlation);
    return ok(Map.of("cases",items,"minimumDisclosure","P5-S3-v1","serverTime",Instant.now().toString()));
  }

  @Transactional
  public Result detail(String caseId,Map<String,Object> body,String correlation){
    Auth auth=authorize(body,"community_moderation.case.read","/internal/v1/community/moderation/cases/"+caseId+"/query"); enrollment(auth.actor());
    List<Map<String,Object>> rows=jdbc.query("SELECT case_id,state,evidence_category,provenance,redaction_state,policy_version,version,reported_at,expires_at FROM community_moderation_cases WHERE case_id=?",
      (r,n)->projection(r),caseId); if(rows.isEmpty()) throw hidden();
    audit("moderation.case_read",CommunityDigest.sha256(caseId),((Number)rows.getFirst().get("version")).intValue(),auth.actor(),correlation);
    return ok(Map.of("case",rows.getFirst(),"minimumDisclosure","P5-S3-v1"));
  }

  @Transactional
  public Result resolve(String caseId,Map<String,Object> body,String key,String correlation){
    Auth auth=authorize(body,"community_moderation.resolve","/internal/v1/community/moderation/cases/"+caseId+"/resolution"); enrollment(auth.actor()); validateKey(key);
    String intent=json(withoutAuth(body)); String kd=CommunityDigest.sha256(key), ad=CommunityDigest.sha256(auth.actor()), id=CommunityDigest.sha256(intent);
    List<Map<String,Object>> saved=jdbc.queryForList("SELECT intent_digest,response_json::text FROM community_moderation_idempotency WHERE key_digest=? AND actor_ref_digest=? AND operation='resolve' AND expires_at>CURRENT_TIMESTAMP",kd,ad);
    if(!saved.isEmpty()){ if(!id.equals(saved.getFirst().get("intent_digest"))) throw fail(HttpStatus.CONFLICT,"COMMUNITY_MODERATION_IDEMPOTENCY_CONFLICT"); try{return ok(mapper.readValue(String.valueOf(saved.getFirst().get("response_json")),new TypeReference<Map<String,Object>>(){}));}catch(Exception e){throw fail(HttpStatus.SERVICE_UNAVAILABLE,"COMMUNITY_SERVICE_UNAVAILABLE");}}
    List<Map<String,Object>> rows=jdbc.queryForList("SELECT state,redaction_state,version,expires_at FROM community_moderation_cases WHERE case_id=? FOR UPDATE",caseId); if(rows.isEmpty())throw hidden();
    Map<String,Object> row=rows.getFirst(); String state=String.valueOf(row.get("state"));
    if(!"open".equals(state))throw fail(HttpStatus.CONFLICT,"COMMUNITY_MODERATION_STATE_CONFLICT");
    if(((Timestamp)row.get("expires_at")).toInstant().isBefore(Instant.now()))throw fail(HttpStatus.CONFLICT,"COMMUNITY_MODERATION_EXPIRED");
    if(!"minimum_redacted".equals(row.get("redaction_state")))throw fail(HttpStatus.CONFLICT,"COMMUNITY_MODERATION_REDACTION_CONFLICT");
    int version=((Number)row.get("version")).intValue(); if(version!=integer(body,"expectedVersion"))throw fail(HttpStatus.CONFLICT,"COMMUNITY_MODERATION_VERSION_CONFLICT");
    String outcome=text(body,"outcome"), reason=text(body,"reason"); validatePair(outcome,reason);
    int next=version+1; Instant now=Instant.now();
    jdbc.update("UPDATE community_moderation_cases SET state='resolved',version=?,resolved_at=?,purge_after=? WHERE case_id=?",next,Timestamp.from(now),Timestamp.from(now.plus(30,ChronoUnit.DAYS)),caseId);
    jdbc.update("INSERT INTO community_moderation_resolutions(resolution_id,case_id,outcome,reason,actor_ref_digest,policy_version,resolved_at,retain_until) VALUES (?,?,?,?,?,'P5-S3-v1',?,?)","resolution_"+UUID.randomUUID().toString().replace("-",""),caseId,outcome,reason,ad,Timestamp.from(now),Timestamp.from(now.plus(365,ChronoUnit.DAYS)));
    audit("moderation.resolved",CommunityDigest.sha256(caseId),next,auth.actor(),correlation);
    jdbc.update("INSERT INTO community_outbox(event_id,event_type,aggregate_id,aggregate_version,lifecycle_outcome,delivery_state,payload,occurred_at,correlation_id,causation_id) VALUES (?,'community.moderation.resolved.v1',?,?,'resolved','suppressed_not_configured',?::jsonb,?,?,?)","event_"+UUID.randomUUID().toString().replace("-",""),caseId,next,json(Map.of("caseId",caseId,"version",next,"outcome",outcome,"policyVersion","P5-S3-v1")),Timestamp.from(now),correlation,text(body,"submissionReference"));
    Map<String,Object> result=Map.of("caseId",caseId,"state","resolved","version",next,"outcome",outcome,"reason",reason,"policyVersion","P5-S3-v1","resolvedAt",now.toString());
    jdbc.update("INSERT INTO community_moderation_idempotency(key_digest,actor_ref_digest,operation,intent_digest,case_id,response_json,created_at,expires_at) VALUES (?,?,'resolve',?,?,?::jsonb,?,?)",kd,ad,id,caseId,json(result),Timestamp.from(now),Timestamp.from(now.plus(24,ChronoUnit.HOURS)));
    return ok(result);
  }

  private Map<String,Object> projection(java.sql.ResultSet r)throws java.sql.SQLException{return Map.of("caseId",r.getString("case_id"),"state",r.getString("state"),"evidenceCategory",r.getString("evidence_category"),"provenance",r.getString("provenance"),"redactionState",r.getString("redaction_state"),"policyVersion",r.getString("policy_version"),"version",r.getInt("version"),"reportedAt",r.getTimestamp("reported_at").toInstant().toString(),"expiresAt",r.getTimestamp("expires_at").toInstant().toString());}
  private void enrollment(String actor){Integer n=jdbc.queryForObject("SELECT count(*) FROM community_moderator_enrollments WHERE actor_ref_digest=? AND status='active' AND expires_at>CURRENT_TIMESTAMP",Integer.class,CommunityDigest.sha256(actor));if(n==null||n==0)throw hidden();}
  private Auth authorize(Map<String,Object> body,String permission,String path){Map<String,Object>a=object(body,"authorization");Instant decided=Instant.parse(text(a,"decidedAt")),expires=Instant.parse(text(a,"expiresAt"));String expected=CommunityDigest.requestDigest(mapper,"POST",path,withoutAuth(body));if(!"community_moderation_resolution".equals(text(a,"purpose"))||!permission.equals(text(a,"permission"))||expires.isBefore(Instant.now())||expires.isAfter(decided.plusSeconds(10))||!CommunityDigest.secretEquals(expected,text(a,"requestDigest")))throw hidden();return new Auth(text(a,"actorRef"));}
  private void validatePair(String outcome,String reason){if(!OUTCOMES.contains(outcome)||!REASONS.contains(reason))throw new IllegalArgumentException("MODERATION_PAIR_INVALID");if("no_change".equals(outcome)&&!Set.of("insufficient_authoritative_evidence","duplicate_report","outside_moderation_scope").contains(reason))throw new IllegalArgumentException("MODERATION_PAIR_INVALID");if(!"no_change".equals(outcome)&&!reason.startsWith("policy_"))throw new IllegalArgumentException("MODERATION_PAIR_INVALID");}
  private void audit(String action,String aggregate,int version,String actor,String correlation){jdbc.update("INSERT INTO community_audit(audit_id,action,outcome,actor_ref_digest,aggregate_ref_digest,aggregate_version,correlation_id,occurred_at) VALUES (?,?,'confirmed',?,?,?,?,?)","audit_"+UUID.randomUUID().toString().replace("-",""),action,CommunityDigest.sha256(actor),aggregate,version,correlation,Timestamp.from(Instant.now()));}
  private Map<String,Object> withoutAuth(Map<String,Object>b){Map<String,Object>v=new LinkedHashMap<>(b);v.remove("authorization");return v;}
  @SuppressWarnings("unchecked") private Map<String,Object> object(Map<String,Object>s,String k){if(!(s.get(k) instanceof Map<?,?>m))throw new IllegalArgumentException("MODERATION_OBJECT_INVALID");return(Map<String,Object>)m;}
  private String text(Map<String,Object>s,String k){if(!(s.get(k) instanceof String v)||v.isBlank())throw new IllegalArgumentException("MODERATION_TEXT_INVALID");return v;}
  private int integer(Map<String,Object>s,String k){if(!(s.get(k) instanceof Number v)||v.intValue()<1)throw new IllegalArgumentException("MODERATION_VERSION_INVALID");return v.intValue();}
  private void validateKey(String k){if(k==null||!k.matches("^[A-Za-z0-9._:-]{8,200}$"))throw fail(HttpStatus.BAD_REQUEST,"COMMUNITY_MODERATION_IDEMPOTENCY_REQUIRED");}
  private String json(Object v){try{return mapper.writeValueAsString(v);}catch(Exception e){throw new IllegalArgumentException("MODERATION_JSON_INVALID",e);}}
  private CommunityFailure hidden(){return fail(HttpStatus.NOT_FOUND,"COMMUNITY_MODERATION_NOT_FOUND");}
  private CommunityFailure fail(HttpStatus s,String c){return new CommunityFailure(s,c,"community.moderation.failure",false);}
  private Result ok(Map<String,Object>b){return new Result(200,b);} public record Result(int status,Map<String,Object>body){} private record Auth(String actor){}
}
