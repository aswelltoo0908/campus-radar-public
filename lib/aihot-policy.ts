/** Enabling collection is separate from confirming permitted use. Defaults are closed. */
export function aihotPolicy(values: Record<string, unknown>) {
  const enabled = String(values.RADAR_AIHOT_ENABLED || "") === "true";
  const permitted = String(values.RADAR_AIHOT_AUTHORIZED || "") === "true";
  return {
    active: enabled && permitted,
    status: enabled && permitted ? "available_opt_in" : enabled ? "authorization_required" : "disabled",
    note: enabled && permitted ? "Authorized AIHOT source; collection requires the student's explicit AI-news opt-in." : enabled
      ? "Confirm permitted use for this product before enabling AIHOT collection."
      : "AIHOT is skipped for this Beta. Direct publisher sources remain available.",
  };
}
