-- CreateEnum
CREATE TYPE "ProjectCategory" AS ENUM ('LANDING_PAGE', 'DASHBOARD', 'PORTFOLIO_BLOG', 'SAAS_APP', 'ECOMMERCE', 'NONE');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "projectCategory" "ProjectCategory" NOT NULL DEFAULT 'NONE';
