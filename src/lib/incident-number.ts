/** Auto-generated and stable: the start date plus the last characters of the status page report id, so the same incident always gets the same number. */
export const incidentNumber = (r: { id: string; startsAt: string }) => `INC-${r.startsAt.slice(0, 10).replace(/-/g, "")}-${String(r.id).replace(/^m-/, "M").slice(-4).toUpperCase().padStart(4, "0")}`;
