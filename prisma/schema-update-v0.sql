-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "dataRegion" TEXT NOT NULL DEFAULT 'US',
ADD COLUMN     "duoConfig" JSONB,
ADD COLUMN     "externalIntegrations" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "franchiseCode" TEXT,
ADD COLUMN     "isFranchisor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kmsConfig" JSONB,
ADD COLUMN     "legalHoldAt" TIMESTAMP(3),
ADD COLUMN     "lmsConfig" JSONB,
ADD COLUMN     "logoData" BYTEA,
ADD COLUMN     "logoMime" TEXT,
ADD COLUMN     "logoUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "parentWorkspaceId" TEXT,
ADD COLUMN     "retentionPolicies" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "siemConfig" JSONB,
ADD COLUMN     "singleTenantRef" TEXT;

-- AlterTable
ALTER TABLE "WorkspaceMember" ADD COLUMN     "orgUnitId" TEXT;

-- AlterTable
ALTER TABLE "EmployeeProfile" ADD COLUMN     "orgUnitId" TEXT;

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "jurisdictionCountries" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "jurisdictionStates" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "CourseLesson" ADD COLUMN     "captionsUrl" TEXT,
ADD COLUMN     "checkpoints" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "minWatchPct" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "videoProvider" TEXT;

-- AlterTable
ALTER TABLE "Policy" ADD COLUMN     "jurisdictionCountries" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "jurisdictionStates" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "IncidentReport" ADD COLUMN     "workersComp" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'US',
ADD COLUMN     "orgUnitId" TEXT,
ADD COLUMN     "state" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "WorkspaceSaml" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "ssoUrl" TEXT NOT NULL,
    "certPem" TEXT NOT NULL,
    "prevCertPem" TEXT,
    "metadataXml" TEXT,
    "domains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "roleAttr" TEXT NOT NULL DEFAULT 'role',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "enforce" BOOLEAN NOT NULL DEFAULT false,
    "testedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceSaml_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScimToken" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY['users:write', 'groups:write']::TEXT[],
    "createdByName" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScimToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiemDelivery" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "statusCode" INTEGER,
    "eventCount" INTEGER NOT NULL DEFAULT 1,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiemDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgUnit" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SITE',
    "code" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolloutWave" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "waveOrder" INTEGER NOT NULL DEFAULT 1,
    "orgUnitIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "locationIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startsAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "launchedAt" TIMESTAMP(3),
    "assignedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolloutWave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FranchisePushLog" (
    "id" TEXT NOT NULL,
    "parentWorkspaceId" TEXT NOT NULL,
    "childWorkspaceId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "pushedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FranchisePushLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureCertificate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "signerEmail" TEXT NOT NULL,
    "documentTitle" TEXT NOT NULL,
    "documentVersion" INTEGER NOT NULL DEFAULT 1,
    "documentSha256" TEXT NOT NULL,
    "verifyCode" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignatureCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestigationCase" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'HARASSMENT',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "legalPrivilege" BOOLEAN NOT NULL DEFAULT false,
    "frozenAt" TIMESTAMP(3),
    "frozenByName" TEXT,
    "leadInvestigatorId" TEXT,
    "leadInvestigatorName" TEXT NOT NULL DEFAULT '',
    "subjectEmployeeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "witnessEmployeeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "summary" TEXT NOT NULL DEFAULT '',
    "findings" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestigationCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestigationEntry" (
    "id" TEXT NOT NULL,
    "investigationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'NOTE',
    "authorName" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "fileId" TEXT,
    "fileName" TEXT,
    "fileSha256" TEXT,
    "isPrivileged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestigationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XapiStatement" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "statementId" TEXT,
    "actorEmail" TEXT NOT NULL,
    "actorName" TEXT NOT NULL DEFAULT '',
    "verb" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "objectName" TEXT NOT NULL DEFAULT '',
    "score" DOUBLE PRECISION,
    "passed" BOOLEAN,
    "source" TEXT NOT NULL DEFAULT 'xapi',
    "raw" JSONB NOT NULL DEFAULT '{}',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XapiStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkJob" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorMemberId" TEXT,
    "actorName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "params" JSONB NOT NULL DEFAULT '{}',
    "rollbackData" JSONB NOT NULL DEFAULT '[]',
    "results" JSONB NOT NULL DEFAULT '[]',
    "rolledBackAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BulkJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceSaml_workspaceId_key" ON "WorkspaceSaml"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ScimToken_tokenHash_key" ON "ScimToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ScimToken_workspaceId_idx" ON "ScimToken"("workspaceId");

-- CreateIndex
CREATE INDEX "SiemDelivery_workspaceId_createdAt_idx" ON "SiemDelivery"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "OrgUnit_workspaceId_parentId_idx" ON "OrgUnit"("workspaceId", "parentId");

-- CreateIndex
CREATE INDEX "RolloutWave_workspaceId_targetType_targetId_idx" ON "RolloutWave"("workspaceId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "FranchisePushLog_parentWorkspaceId_createdAt_idx" ON "FranchisePushLog"("parentWorkspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "FranchisePushLog_childWorkspaceId_createdAt_idx" ON "FranchisePushLog"("childWorkspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SignatureCertificate_verifyCode_key" ON "SignatureCertificate"("verifyCode");

-- CreateIndex
CREATE INDEX "SignatureCertificate_workspaceId_kind_recordId_idx" ON "SignatureCertificate"("workspaceId", "kind", "recordId");

-- CreateIndex
CREATE INDEX "SignatureCertificate_workspaceId_signedAt_idx" ON "SignatureCertificate"("workspaceId", "signedAt");

-- CreateIndex
CREATE INDEX "InvestigationCase_workspaceId_status_createdAt_idx" ON "InvestigationCase"("workspaceId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InvestigationCase_workspaceId_caseNumber_key" ON "InvestigationCase"("workspaceId", "caseNumber");

-- CreateIndex
CREATE INDEX "InvestigationEntry_investigationId_createdAt_idx" ON "InvestigationEntry"("investigationId", "createdAt");

-- CreateIndex
CREATE INDEX "XapiStatement_workspaceId_receivedAt_idx" ON "XapiStatement"("workspaceId", "receivedAt");

-- CreateIndex
CREATE INDEX "XapiStatement_workspaceId_actorEmail_idx" ON "XapiStatement"("workspaceId", "actorEmail");

-- CreateIndex
CREATE INDEX "BulkJob_workspaceId_createdAt_idx" ON "BulkJob"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_franchiseCode_key" ON "Workspace"("franchiseCode");

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_parentWorkspaceId_fkey" FOREIGN KEY ("parentWorkspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceSaml" ADD CONSTRAINT "WorkspaceSaml_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScimToken" ADD CONSTRAINT "ScimToken_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiemDelivery" ADD CONSTRAINT "SiemDelivery_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgUnit" ADD CONSTRAINT "OrgUnit_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgUnit" ADD CONSTRAINT "OrgUnit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolloutWave" ADD CONSTRAINT "RolloutWave_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureCertificate" ADD CONSTRAINT "SignatureCertificate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestigationCase" ADD CONSTRAINT "InvestigationCase_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestigationEntry" ADD CONSTRAINT "InvestigationEntry_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "InvestigationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XapiStatement" ADD CONSTRAINT "XapiStatement_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkJob" ADD CONSTRAINT "BulkJob_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
