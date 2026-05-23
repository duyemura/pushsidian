import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { inviteService } from "./invite.service";
import { slackService } from "../slack/slack.service";
import { notifyMemberJoined } from "../slack/webhook.service";
import { verifyAuth } from "../auth";
import { getDB } from "../db";

const routes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    "/",
    {
      schema: {
        body: z.object({
          org_id: z.string(),
          slack_handle: z.string().min(1),
          groups: z.array(z.string()).default([]),
          role: z.enum(["member", "admin"]).default("member"),
        }),
        response: {
          200: z.object({ token: z.string(), link: z.string(), dm_sent: z.boolean().optional() }),
        },
      },
    },
    async (req) => {
      const user = await verifyAuth(req);
      const body = req.body as { org_id: string; slack_handle: string; groups: string[]; role: string };

      // Resolve Slack handle to user ID and send DM
      const slackUserId = await slackService.resolveHandle(body.slack_handle);
      const baseUrl = process.env.APP_BASE_URL || "http://localhost:5175";
      const { token } = await inviteService.create({
        org_id: body.org_id,
        slack_handle: body.slack_handle,
        slack_user_id: slackUserId,
        groups: body.groups,
        role: body.role,
        created_by: user.id,
      });
      const link = `${baseUrl}/join?token=${token}`;

      let dmSent = false;
      if (slackUserId) {
        const org = await inviteService.getOrg(body.org_id);
        const dmResult = await slackService.sendDM(
          slackUserId,
          `You\'ve been invited to join *${org?.display_name ?? "a team"}* on Pushsidian.\n\nClick here to get started: ${link}`
        );
        dmSent = dmResult.ok;
      }

      return { token, link, dm_sent: dmSent };
    }
  );

  app.get(
    "/:token",
    {
      schema: {
        params: z.object({ token: z.string() }),
        response: {
          200: z.object({
            valid: z.boolean(),
            org_id: z.string().optional(),
            org_name: z.string().optional(),
            org_slug: z.string().optional(),
            slack_handle: z.string().optional(),
            used: z.boolean().optional(),
            expired: z.boolean().optional(),
          }),
        },
      },
    },
    async (req) => {
      const { token } = req.params as { token: string };
      const result = await inviteService.validate(token);
      if (!result) return { valid: false };
      if ("used" in result) return { valid: false, used: true };
      if ("expired" in result) return { valid: false, expired: true };
      return {
        valid: true,
        org_id: result.org?.id,
        org_name: result.org?.display_name,
        org_slug: result.org?.slug,
        slack_handle: result.invite.slack_handle ?? undefined,
      };
    }
  );

  app.post(
    "/:token/accept",
    {
      schema: {
        params: z.object({ token: z.string() }),
        response: {
          200: z.object({ org_id: z.string() }),
        },
      },
    },
    async (req) => {
      const user = await verifyAuth(req);
      const { token } = req.params as { token: string };
      const result = await inviteService.accept(token, user.id);

      // Notify team channel that someone joined
      const db = getDB();
      const invite = await db
        .selectFrom("invite_tokens")
        .select(["org_id", "created_by", "slack_handle"])
        .where("token", "=", token)
        .executeTakeFirst();

      if (invite) {
        // Copy slack_handle from invite to user's subject record
        if (invite.slack_handle) {
          await db
            .updateTable("subjects")
            .set({ slack_handle: invite.slack_handle })
            .where("id", "=", user.id)
            .execute();
        }

        let invitedByName: string | null = null;
        if (invite.created_by) {
          const inviter = await db
            .selectFrom("subjects")
            .select("display_name")
            .where("id", "=", invite.created_by)
            .executeTakeFirst();
          invitedByName = inviter?.display_name ?? null;
        }

        void notifyMemberJoined(
          invite.org_id,
          user.displayName,
          invitedByName
        );
      }

      return result;
    }
  );

  app.get(
    "/org/:org_id",
    {
      schema: {
        params: z.object({ org_id: z.string() }),
      },
    },
    async (req) => {
      await verifyAuth(req);
      const { org_id } = req.params as { org_id: string };
      const invites = await inviteService.listForOrg(org_id);
      return invites.map((i) => ({
        id: i.id,
        slack_handle: i.slack_handle,
        role: i.role,
        token: i.token,
        used_by: i.used_by,
        used_at: i.used_at?.toISOString(),
        expires_at: i.expires_at.toISOString(),
        created_at: i.created_at.toISOString(),
      }));
    }
  );
};

export default routes;
