FROM eclipse-temurin:25.0.2_10-jdk@sha256:1bda4d9e668f44f399abed30636c34e0befb727408fba27b1e6aaefcf9df346b AS build
WORKDIR /repo
COPY .mvn .mvn
COPY mvnw ./
COPY services/community services/community
RUN ./mvnw -B -ntp -f services/community/pom.xml clean verify
FROM eclipse-temurin:25.0.2_10-jre@sha256:1089975c9ab22e822faf568c0e03997ee707165a125b7a55fbc799315b63d697
RUN useradd --system --uid 10001 lifebridge
USER 10001
WORKDIR /app
COPY --from=build --chown=10001:10001 /repo/services/community/target/lifebridge-community.jar ./lifebridge-community.jar
COPY --from=build --chown=10001:10001 /repo/services/community/target/classes/META-INF/sbom/community-sbom.json ./sbom/community.cdx.json
ENV COMMUNITY_HOST=0.0.0.0 RUNTIME_MODE=production
EXPOSE 3103
ENTRYPOINT ["java","-jar","lifebridge-community.jar"]
