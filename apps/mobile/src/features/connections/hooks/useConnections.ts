import { useQuery } from "@tanstack/react-query";

import { connectionsApi } from "../../../services/api/connections";

export function useConnections() {
  return useQuery({
    queryKey: ["connections"],
    queryFn: () => connectionsApi.list(),
  });
}
