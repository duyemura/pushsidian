import "dotenv/config";
import { uploadDocument } from "../src/s3";

async function main() {
  await uploadDocument(
    "org_9ce8f7e3-a7b1-41cd-94dd-14615baa2590/vault1/Runbooks/Deploy.md",
    "# Deploy Runbook\n\n1. SSH into server\n2. Run deploy script\n3. Verify health check\n\nShared by Alice with the team."
  );
  console.log("Uploaded Alice runbook to R2");
}

main().catch(console.error);
