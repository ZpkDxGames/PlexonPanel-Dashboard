import { demoOverview } from "./demo-data";
import type { DashboardOverview } from "./dashboard-types";

export interface DashboardDataSource {
  getOverview(): Promise<DashboardOverview>;
}

export const demoDataSource: DashboardDataSource = {
  async getOverview() {
    return demoOverview;
  },
};
