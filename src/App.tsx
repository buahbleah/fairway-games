import { useRouter } from './state/router'
import { HomeScreen } from './screens/Home'
import { GameSelectScreen } from './screens/GameSelect'
import { GameInfoScreen } from './screens/GameInfo'
import { SetupScreen } from './screens/Setup'
import { PlayScreen } from './screens/Play'
import { ResultsScreen } from './screens/Results'
import { HistoryScreen } from './screens/HistoryScreen'
import { SettingsScreen } from './screens/Settings'
import { AccountScreen } from './screens/Account'
import { FriendsScreen } from './screens/Friends'
import { LeaguesScreen } from './screens/Leagues'
import { LeagueDetailScreen } from './screens/LeagueDetail'

export function App() {
  const { route } = useRouter()
  const { path } = route

  let screen = <HomeScreen />
  if (path === '/games') screen = <GameSelectScreen />
  else if (path.startsWith('/game/')) screen = <GameInfoScreen gameId={path.slice('/game/'.length)} />
  else if (path === '/setup') screen = <SetupScreen />
  else if (path === '/play') screen = <PlayScreen />
  else if (path === '/results') screen = <ResultsScreen />
  else if (path === '/history') screen = <HistoryScreen />
  else if (path === '/settings') screen = <SettingsScreen />
  else if (path === '/account') screen = <AccountScreen />
  else if (path === '/friends') screen = <FriendsScreen />
  else if (path === '/leagues') screen = <LeaguesScreen />
  else if (path.startsWith('/league/')) screen = <LeagueDetailScreen leagueId={path.slice('/league/'.length)} />

  return <div className="app-shell">{screen}</div>
}
