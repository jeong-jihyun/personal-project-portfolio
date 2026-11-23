ALTER TABLE "projects" ADD COLUMN "github_repo" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "github_pushed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "github_synced_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_owner_github_repo_unique" ON "projects" USING btree ("owner_id","github_repo") WHERE "projects"."github_repo" IS NOT NULL;