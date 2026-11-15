# API image (ASP.NET Core, .NET 10). Build from the repository root:
#   docker build -t umbrella-api .
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first, so package downloads are cached until a project file changes.
COPY UmbrellaMedical.Api/UmbrellaMedical.Api.csproj UmbrellaMedical.Api/
COPY UmbrellaMedical.Domain/UmbrellaMedical.Domain.csproj UmbrellaMedical.Domain/
COPY UmbrellaMedical.Infrastructure/UmbrellaMedical.Infrastructure.csproj UmbrellaMedical.Infrastructure/
RUN dotnet restore UmbrellaMedical.Api/UmbrellaMedical.Api.csproj

COPY UmbrellaMedical.Api/ UmbrellaMedical.Api/
COPY UmbrellaMedical.Domain/ UmbrellaMedical.Domain/
COPY UmbrellaMedical.Infrastructure/ UmbrellaMedical.Infrastructure/
RUN dotnet publish UmbrellaMedical.Api/UmbrellaMedical.Api.csproj -c Release -o /out --no-restore /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
# Uploaded files (photos, documents, prescriptions) live here; docker-compose mounts a volume on it.
RUN mkdir -p /app/App_Data/uploads && chown -R app:app /app/App_Data
COPY --from=build /out .
USER app
EXPOSE 8080
ENTRYPOINT ["dotnet", "UmbrellaMedical.Api.dll"]
