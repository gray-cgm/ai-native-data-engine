import { OpsModuleListPage } from '../components/ops-module-list-page'
import { PromoteToOfficialButton } from '../components/promote-to-official-button'

export default function ReleasePage() {
  return (
    <OpsModuleListPage
      module="release"
      extraRowActions={(row, refresh) => (
        <PromoteToOfficialButton item={row} refresh={refresh} />
      )}
    />
  )
}
