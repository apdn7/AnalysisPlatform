# SearchSelect Component

Searchable dropdown select with 2-column display and clear button (like Select2).

## Features

- 🔍 Real-time search filtering
- 📊 2-column grid layout
- ❌ Clear button (× icon)
- ⌨️ Keyboard navigation
- ♿ Accessibility compliant
- 📱 Responsive design

## Quick Start

### Import
```tsx
import { SearchSelect, type TwoColumnOption } from '@/shared/components/ui/SearchSelect';
```

### Usage
```tsx
import { useState } from 'react';
import { SearchSelect, type TwoColumnOption } from '@/shared/components/ui/SearchSelect';

const options: TwoColumnOption[] = [
    { value: 'proc_001', col1: 'Process A', col2: 'Production Line 1' },
    { value: 'proc_002', col1: 'Process B', col2: 'Production Line 2' },
    { value: 'proc_003', col1: 'Process C', col2: 'Quality Check' },
];

export function MyComponent() {
    const [selected, setSelected] = useState<string | number | null>(null);

    return (
        <SearchSelect
            id="process-select"
            name="process_id"
            value={selected}
            options={options}
            onChange={setSelected}
            placeholder="Select a process..."
            searchPlaceholder="Search process or line..."
            selectedDisplayMode="col1"
        />
    );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `id` | string | - | HTML id attribute |
| `name` | string | - | HTML name (for forms) |
| `value` | string \| number \| null | null | Selected value |
| `options` | TwoColumnOption[] | - | Options array |
| `onChange` | function | - | Change callback |
| `placeholder` | string | 'Select an option...' | When nothing selected |
| `disabled` | boolean | false | Disable state |
| `className` | string | '' | Additional CSS classes |
| `searchPlaceholder` | string | 'Search...' | Search box hint |
| `selectedDisplayMode` | 'col1' \| 'col2' \| 'both' | 'col1' | Display format |

## Data Structure

```typescript
interface TwoColumnOption {
    value: string | number;  // Unique identifier
    col1: string;            // First column content
    col2: string;            // Second column content
}
```

## Display Modes

- **col1**: Show only first column
- **col2**: Show only second column
- **both**: Show both columns (e.g., "Process A - Line 1")

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Esc` | Close dropdown |
| `Enter` | Select first option |
| `Type` | Search options |

## CSS Modules

Component uses CSS Modules for styling (scoped to component).

## File Structure

```
SearchSelect/
├── SearchSelect.tsx         # Main component
├── SearchSelect.module.scss # Styling
├── types.ts                 # TypeScript interfaces
├── index.ts                 # Export barrel
└── README.md               # This file
```

## Examples

### Example 1: Basic
```tsx
<SearchSelect
    options={options}
    value={selected}
    onChange={setSelected}
/>
```

### Example 2: With Both Columns Display
```tsx
<SearchSelect
    options={options}
    value={selected}
    onChange={setSelected}
    selectedDisplayMode="both"
/>
```

### Example 3: In a Form
```tsx
<form onSubmit={handleSubmit}>
    <SearchSelect
        name="process"
        options={options}
        value={selected}
        onChange={setSelected}
    />
    <button type="submit">Submit</button>
</form>
```

## Features Detail

### Search Input
- Filters both col1 and col2
- Case-insensitive
- Real-time filtering
- Shows in dropdown when open

### 2-Column Layout
```
┌─────────────────────┐
│ Process A │ Line 1  │
├───────────┼─────────┤
│ Process B │ Line 2  │
└─────────────────────┘
```

### Clear Button
- Icon: × (similar to Select2's `.select2-selection__clear`)
- Only shows when value is selected
- Hover effect with background change

### Keyboard Navigation
- Escape: Close dropdown
- Enter: Select first option
- Type: Search options

## Accessibility

- ARIA labels on clear button
- Keyboard navigation support
- Focus management
- Semantic HTML

## Browser Support

Modern browsers supporting:
- React 16.8+ (Hooks)
- CSS Grid Layout
- ES6+ JavaScript

## Related

- `CustomSelect.tsx` - Alternative custom select
- `Select.tsx` - Basic HTML select wrapper

## License

Part of APDN7 project

