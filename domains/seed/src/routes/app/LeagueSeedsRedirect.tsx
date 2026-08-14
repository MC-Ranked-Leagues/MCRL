import { Navigate, useParams } from "react-router";

export function LeagueSeedsRedirect() {
  const { leagueId } = useParams();

  return leagueId ? (
    <Navigate replace to={`/app/league/${leagueId}`} />
  ) : (
    <Navigate replace to="/app" />
  );
}
