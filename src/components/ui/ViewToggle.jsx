import { LayoutGrid, List } from 'lucide-react'
import Tabs from './Tabs'

// Grid / List switch for entity lists (pair with useViewMode). Hidden on phones, where
// both views already stack as cards.
export default function ViewToggle({ value, onChange, className = '' }) {
  return (
    <Tabs
      size="sm"
      label="View"
      value={value}
      onChange={onChange}
      className={`hidden sm:inline-flex ${className}`}
      tabs={[
        { value: 'grid', label: 'Grid', icon: LayoutGrid },
        { value: 'list', label: 'List', icon: List },
      ]}
    />
  )
}
