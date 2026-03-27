import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DeliveryTimestamps } from "@/components/packages/DeliveryStatusTracker";

interface NotificationStatusRow {
  package_id: string | null;
  status?: string | null;
  success?: boolean | null;
  accepted_at?: string | null;
  sent_at?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
}

interface PackageNotificationData {
  status: string;
  timestamps: DeliveryTimestamps;
}

/**
 * Fetches the latest WhatsApp notification delivery status for a list of package IDs.
 * Returns a map of packageId → { status, timestamps }.
 */
export function usePackageNotificationStatus(packageIds: string[]) {
  const [dataMap, setDataMap] = useState<Record<string, PackageNotificationData>>({});

  useEffect(() => {
    if (packageIds.length === 0) {
      setDataMap({});
      return;
    }

    const fetchStatuses = async () => {
      const { data, error } = await supabase
        .from("whatsapp_notification_logs")
        .select("package_id, status, success, accepted_at, sent_at, delivered_at, read_at")
        .in("package_id", packageIds)
        .eq("success", true)
        .order("created_at", { ascending: false });

      let rows = (data ?? []) as NotificationStatusRow[];

      if (error) {
        const { data: legacyData, error: legacyError } = await supabase
          .from("whatsapp_notification_logs")
          .select("package_id, success")
          .in("package_id", packageIds)
          .eq("success", true)
          .order("created_at", { ascending: false });

        if (legacyError) {
          console.error("Error fetching package notification statuses:", legacyError);
          setDataMap({});
          return;
        }

        rows = (legacyData ?? []) as NotificationStatusRow[];
      }

      if (!rows.length) {
        setDataMap({});
        return;
      }

      // Keep only the latest status per package
      const map: Record<string, PackageNotificationData> = {};
      for (const row of rows) {
        const resolvedStatus = row.status ?? (row.success ? "sent" : null);

        if (row.package_id && resolvedStatus && !map[row.package_id]) {
          map[row.package_id] = {
            status: resolvedStatus,
            timestamps: {
              accepted_at: row.accepted_at ?? null,
              sent_at: row.sent_at ?? null,
              delivered_at: row.delivered_at ?? null,
              read_at: row.read_at ?? null,
            },
          };
        }
      }
      setDataMap(map);
    };

    fetchStatuses();

    // Realtime updates
    const channel = supabase
      .channel("pkg-notif-status-cards")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "whatsapp_notification_logs",
        },
        (payload) => {
          const updated = payload.new as any;
          if (updated.package_id && updated.status && packageIds.includes(updated.package_id)) {
            setDataMap((prev) => ({
              ...prev,
              [updated.package_id]: {
                status: updated.status,
                timestamps: {
                  accepted_at: updated.accepted_at ?? prev[updated.package_id]?.timestamps?.accepted_at ?? null,
                  sent_at: updated.sent_at ?? prev[updated.package_id]?.timestamps?.sent_at ?? null,
                  delivered_at: updated.delivered_at ?? prev[updated.package_id]?.timestamps?.delivered_at ?? null,
                  read_at: updated.read_at ?? prev[updated.package_id]?.timestamps?.read_at ?? null,
                },
              },
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [packageIds.join(",")]);

  // Return both the legacy statusMap format and the new dataMap
  const statusMap: Record<string, string> = {};
  for (const [key, val] of Object.entries(dataMap)) {
    statusMap[key] = val.status;
  }

  return { statusMap, dataMap };
}
