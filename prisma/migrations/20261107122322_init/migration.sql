-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'PROPOSED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ScopeItemKind" AS ENUM ('DELIVERABLE', 'EXCLUSION');

-- CreateEnum
CREATE TYPE "ScopeOrigin" AS ENUM ('PROPOSAL', 'CHANGE_REQUEST');

-- CreateEnum
CREATE TYPE "MilestoneKind" AS ENUM ('DEPOSIT', 'DELIVERY', 'CHANGE_ORDER');

-- CreateEnum
CREATE TYPE "TermsStatus" AS ENUM ('DRAFT', 'APPROVED');

-- CreateEnum
CREATE TYPE "WorkStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'CHANGES_REQUESTED', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "MilestonePaymentStatus" AS ENUM ('UNPAID', 'REQUESTED', 'PROCESSING', 'PAID');

-- CreateEnum
CREATE TYPE "ProposalVersionStatus" AS ENUM ('PENDING', 'APPROVED', 'REVISION_REQUESTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('DRAFT', 'PENDING_CLIENT', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "BillingTiming" AS ENUM ('ON_APPROVAL', 'ON_DELIVERY');

-- CreateEnum
CREATE TYPE "ApprovalSubject" AS ENUM ('PROPOSAL_VERSION', 'CHANGE_REQUEST', 'MILESTONE_DELIVERY');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('FREELANCER', 'CLIENT', 'SYSTEM', 'PAYPAL');

-- CreateEnum
CREATE TYPE "PaymentRequestStatus" AS ENUM ('OPEN', 'PROCESSING', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('CREATED', 'APPROVED', 'CAPTURING', 'COMPLETED', 'PENDING', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('COMPLETED', 'PENDING', 'DECLINED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "VerificationSource" AS ENUM ('CAPTURE_RESPONSE', 'WEBHOOK', 'RECONCILIATION');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "AIAnalysisKind" AS ENUM ('PROJECT_EXTRACTION', 'PROPOSAL_DRAFT', 'SCOPE_COMPARISON');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreelancerProfile" (
    "userId" TEXT NOT NULL,
    "businessName" TEXT,
    "defaultCurrency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "hourlyRate" DECIMAL(14,2),
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "demoExpiresAt" TIMESTAMP(3),
    "onboardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FreelancerProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "company" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "budget" DECIMAL(14,2) NOT NULL,
    "startDate" TIMESTAMP(3),
    "acceptanceCriteria" TEXT[],
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "aiReview" JSONB,
    "sourceAnalysisId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScopeItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "ScopeItemKind" NOT NULL,
    "origin" "ScopeOrigin" NOT NULL DEFAULT 'PROPOSAL',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "milestoneId" TEXT,
    "changeRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScopeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" "MilestoneKind" NOT NULL DEFAULT 'DELIVERY',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "termsStatus" "TermsStatus" NOT NULL DEFAULT 'DRAFT',
    "workStatus" "WorkStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "paymentStatus" "MilestonePaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "requiresDelivery" BOOLEAN NOT NULL DEFAULT true,
    "submissionNote" TEXT,
    "submittedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "changeRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "overview" TEXT NOT NULL,
    "timelineSummary" TEXT NOT NULL DEFAULT '',
    "paymentConditions" TEXT NOT NULL DEFAULT '',
    "revisionLimit" INTEGER NOT NULL DEFAULT 2,
    "revisionPolicy" TEXT NOT NULL DEFAULT '',
    "changeRequestPolicy" TEXT NOT NULL DEFAULT '',
    "acceptanceStatement" TEXT NOT NULL DEFAULT '',
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalVersion" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "termsHash" VARCHAR(64) NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" "ProposalVersionStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "clientNote" TEXT,

    CONSTRAINT "ProposalVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScopeChangeRequest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requestText" TEXT NOT NULL,
    "deliverables" JSONB NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "billingTiming" "BillingTiming" NOT NULL DEFAULT 'ON_APPROVAL',
    "dueDate" TIMESTAMP(3),
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "termsHash" VARCHAR(64),
    "analysisId" TEXT,
    "sentAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "clientNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScopeChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "subjectType" "ApprovalSubject" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorEmail" TEXT,
    "accessGrantId" TEXT,
    "termsHash" VARCHAR(64),
    "amount" DECIMAL(14,2),
    "currency" VARCHAR(3),
    "comment" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientAccessGrant" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "tokenCiphertext" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientAccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRequest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "description" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "PaymentRequestStatus" NOT NULL DEFAULT 'OPEN',
    "activeKey" TEXT,
    "captureLockId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "paymentRequestId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'paypal',
    "environment" TEXT NOT NULL,
    "providerOrderId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'CREATED',
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "paymentRequestId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'paypal',
    "environment" TEXT NOT NULL,
    "providerCaptureId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" "TransactionStatus" NOT NULL,
    "verifiedVia" "VerificationSource" NOT NULL,
    "payerId" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'paypal',
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "resourceId" TEXT,
    "verified" BOOLEAN NOT NULL,
    "status" "WebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIAnalysis" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "projectId" TEXT,
    "kind" "AIAnalysisKind" NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "output" JSONB,
    "succeeded" BOOLEAN NOT NULL,
    "error" TEXT,
    "latencyMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "actorType" "ActorType" NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "Client_ownerId_idx" ON "Client"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_sourceAnalysisId_key" ON "Project"("sourceAnalysisId");

-- CreateIndex
CREATE INDEX "Project_ownerId_status_idx" ON "Project"("ownerId", "status");

-- CreateIndex
CREATE INDEX "Project_clientId_idx" ON "Project"("clientId");

-- CreateIndex
CREATE INDEX "ScopeItem_projectId_kind_idx" ON "ScopeItem"("projectId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Milestone_changeRequestId_key" ON "Milestone"("changeRequestId");

-- CreateIndex
CREATE INDEX "Milestone_projectId_position_idx" ON "Milestone"("projectId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_projectId_key" ON "Proposal"("projectId");

-- CreateIndex
CREATE INDEX "ProposalVersion_proposalId_status_idx" ON "ProposalVersion"("proposalId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProposalVersion_proposalId_version_key" ON "ProposalVersion"("proposalId", "version");

-- CreateIndex
CREATE INDEX "ScopeChangeRequest_projectId_status_idx" ON "ScopeChangeRequest"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ScopeChangeRequest_projectId_number_key" ON "ScopeChangeRequest"("projectId", "number");

-- CreateIndex
CREATE INDEX "Approval_projectId_subjectType_subjectId_idx" ON "Approval"("projectId", "subjectType", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientAccessGrant_tokenHash_key" ON "ClientAccessGrant"("tokenHash");

-- CreateIndex
CREATE INDEX "ClientAccessGrant_projectId_idx" ON "ClientAccessGrant"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRequest_activeKey_key" ON "PaymentRequest"("activeKey");

-- CreateIndex
CREATE INDEX "PaymentRequest_projectId_status_idx" ON "PaymentRequest"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_providerOrderId_key" ON "PaymentAttempt"("providerOrderId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_paymentRequestId_idx" ON "PaymentAttempt"("paymentRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_providerCaptureId_key" ON "PaymentTransaction"("providerCaptureId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_paymentRequestId_idx" ON "PaymentTransaction"("paymentRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_eventId_key" ON "WebhookEvent"("eventId");

-- CreateIndex
CREATE INDEX "AIAnalysis_ownerId_createdAt_idx" ON "AIAnalysis"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "AIAnalysis_projectId_kind_idx" ON "AIAnalysis"("projectId", "kind");

-- CreateIndex
CREATE INDEX "AuditEvent_projectId_createdAt_idx" ON "AuditEvent"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreelancerProfile" ADD CONSTRAINT "FreelancerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_sourceAnalysisId_fkey" FOREIGN KEY ("sourceAnalysisId") REFERENCES "AIAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScopeItem" ADD CONSTRAINT "ScopeItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScopeItem" ADD CONSTRAINT "ScopeItem_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScopeItem" ADD CONSTRAINT "ScopeItem_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ScopeChangeRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ScopeChangeRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalVersion" ADD CONSTRAINT "ProposalVersion_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScopeChangeRequest" ADD CONSTRAINT "ScopeChangeRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScopeChangeRequest" ADD CONSTRAINT "ScopeChangeRequest_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "AIAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAccessGrant" ADD CONSTRAINT "ClientAccessGrant_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAccessGrant" ADD CONSTRAINT "ClientAccessGrant_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "PaymentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAnalysis" ADD CONSTRAINT "AIAnalysis_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAnalysis" ADD CONSTRAINT "AIAnalysis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
