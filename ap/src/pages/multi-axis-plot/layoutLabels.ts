// Display labels for layout values. Shared by the end process LayoutPanel and the
// Variable Select modal so both cells render the same text for the same value.
const VALUE_LABEL_MAP: Record<string, string> = {
    x_axis: 'X-axis',
    lab: 'Lab',
    lab_x: 'LabX',
    color: 'Color',
    color_x: 'ColorX',
    color_imb: 'ColImb',
    color_imb_x: 'ColImbX',
    group: 'Group',
};

export function getDisplayLabel(value: string): string {
    if (!value) return '---';
    if (VALUE_LABEL_MAP[value]) return VALUE_LABEL_MAP[value];

    const match = value.match(/^([1-6])(.+)$/);
    if (match) {
        const [, num, field] = match;
        const fieldLabelMap: Record<string, string> = {
            lab: 'Lab',
            step: 'Step',
            main: 'Main',
            sub: '-2nd',
            add: 'Auto',
            color: 'Color',
            color_imb: 'ColImb',
        };
        return `${num}${fieldLabelMap[field] ?? field}`;
    }

    return value;
}
