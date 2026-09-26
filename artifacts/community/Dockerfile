FROM eclipse-temurin:25.0.2_10-jdk@sha256:1bda4d9e668f44f399abed30636c34e0befb727408fba27b1e6aaefcf9df346b AS build
WORKDIR /repo
COPY services/community services/community
COPY contracts/community/p5-s1-v1 contracts/community/p5-s1-v1
ADD --checksum=sha256:5af3b743dd8b876b5c45da33b676251e5f1687712644abb4ee519ca56e1d89ce https://archive.apache.org/dist/maven/maven-3/3.9.16/binaries/apache-maven-3.9.16-bin.zip /tmp/maven.zip
RUN mkdir -p /opt/maven && cd /opt/maven && jar -xf /tmp/maven.zip && chmod 0555 /opt/maven/apache-maven-3.9.16/bin/mvn && /opt/maven/apache-maven-3.9.16/bin/mvn -B -ntp -f /repo/services/community/pom.xml clean verify
FROM eclipse-temurin:25.0.2_10-jre@sha256:1089975c9ab22e822faf568c0e03997ee707165a125b7a55fbc799315b63d697
RUN useradd --system --uid 10001 lifebridge
USER 10001
WORKDIR /app
COPY --from=build --chown=10001:10001 /repo/services/community/target/lifebridge-community.jar ./lifebridge-community.jar
COPY --from=build --chown=10001:10001 /repo/services/community/target/classes/META-INF/sbom/community-sbom.json ./sbom/community.cdx.json
ENV COMMUNITY_HOST=0.0.0.0 RUNTIME_MODE=production
EXPOSE 3103
ENTRYPOINT ["java","-jar","lifebridge-community.jar"]
