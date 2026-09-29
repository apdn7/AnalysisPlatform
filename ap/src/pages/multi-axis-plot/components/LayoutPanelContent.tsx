import { useTranslation } from 'react-i18next';

const RESET_FIELD = { value: '', label: '---' };

const GLOBAL_FIELDS = [
    { value: 'x_axis', label: 'X-axis' },
    { value: 'lab_x', label: 'LabX' },
    { value: 'color_x', label: 'ColorX' },
    { value: 'color_imb_x', label: 'ColImbX' },
];

const SHARED_FIELDS = [
    { value: 'lab', label: 'Lab' },
    { value: 'color', label: 'Color' },
    { value: 'color_imb', label: 'ColImb' },
];

const PER_PLOT_FIELDS = [
    { field: 'lab', label: 'i-Lab' },
    { field: 'step', label: 'i-Step' },
];

const OVERLAY_FIELDS = [
    { field: 'main', label: 'i-Main' },
    { field: 'sub', label: 'i-2nd' },
    { field: 'add', label: 'i-Auto' },
];

const COLOR_FIELDS = [
    { field: 'color', label: 'iColor' },
    { field: 'color_imb', label: 'iColImb' },
];

const SUBPLOT_NUMBERS = [1, 2, 3, 4, 5, 6];

function ToggleButton({
    value,
    label,
    isActive,
    disabled = false,
    onClick,
}: {
    value: string;
    label: string;
    isActive: boolean;
    disabled?: boolean;
    onClick: (value: string) => void;
}) {
    return (
        <button
            type="button"
            className={`layout-toggle-btn ${isActive ? 'layout-toggle-btn--active' : ''}`}
            disabled={disabled}
            onClick={() => onClick(isActive ? '' : value)}
        >
            {label}
        </button>
    );
}

function SubplotButtonRow({
    field,
    label,
    availableNumbers,
    currentValue,
    disabled = false,
    onSelect,
}: {
    field: string;
    label: string;
    availableNumbers: number[];
    currentValue: string;
    disabled?: boolean;
    onSelect: (value: string) => void;
}) {
    return (
        <div className={`layout-subplot-row ${disabled ? 'layout-subplot-row--disabled' : ''}`}>
            <span className="layout-subplot-row__label">{label}</span>
            <div className="layout-subplot-row__buttons">
                {availableNumbers.map((num) => {
                    const value = `${num}${field}`;
                    const isActive = currentValue === value;
                    return (
                        <button
                            key={num}
                            type="button"
                            className={`layout-subplot-row__btn ${isActive ? 'layout-subplot-row__btn--active' : ''}`}
                            disabled={disabled}
                            onClick={() => onSelect(isActive ? '' : value)}
                        >
                            {num}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Main export ─────────────────────────────────────────────
export type LayoutVariablePanelProps = {
    currentValue: string;
    selected: boolean;
    maxOrder: number;
    isCategory?: boolean;
    datatype?: string;
    onSelect: (value: string) => void;
};

export default function LayoutPanelContent({
    currentValue,
    selected,
    maxOrder,
    isCategory,
    datatype,
    onSelect,
}: LayoutVariablePanelProps) {
    const { t } = useTranslation();
    if (selected) {
        const maxSelectable = Math.min(maxOrder, 6);
        return (
            <div className="layout-variable-panel layout-variable-panel--primary">
                <div className="layout-variable-panel__primary-list">
                    <ToggleButton
                        value={RESET_FIELD.value}
                        label={RESET_FIELD.label}
                        isActive={false}
                        onClick={onSelect}
                    />
                    {SUBPLOT_NUMBERS.map((num) => (
                        <ToggleButton
                            key={num}
                            value={String(num)}
                            label={String(num)}
                            isActive={currentValue === String(num)}
                            disabled={num > maxSelectable}
                            onClick={onSelect}
                        />
                    ))}
                </div>
            </div>
        );
    }

    const availableNumbers = SUBPLOT_NUMBERS.filter((num) => num <= maxOrder);

    const isMainDisabled = isCategory || datatype === 'TEXT';

    return (
        <div className="layout-variable-panel">
            <div className="layout-variable-panel__section">
                <ToggleButton value={RESET_FIELD.value} label={RESET_FIELD.label} isActive={false} onClick={onSelect} />
            </div>

            {/*GLOBAL_FIELDS*/}
            <div className="layout-variable-panel__section">
                <h3 className="layout-variable-panel__section-title">{t('X-axis settings')}</h3>
                <div className="layout-variable-panel__divider" />
                <div className="layout-variable-panel__toggle-group">
                    {GLOBAL_FIELDS.map((item) => (
                        <ToggleButton
                            key={item.value}
                            value={item.value}
                            label={item.label}
                            isActive={currentValue === item.value}
                            onClick={onSelect}
                        />
                    ))}
                </div>
            </div>

            {/*SHARED_FIELDS*/}
            <div className="layout-variable-panel__section">
                <h3 className="layout-variable-panel__section-title">{t('Shared settings')}</h3>
                <div className="layout-variable-panel__divider" />
                <div className="layout-variable-panel__toggle-group">
                    {SHARED_FIELDS.map((item) => (
                        <ToggleButton
                            key={item.value}
                            value={item.value}
                            label={item.label}
                            isActive={currentValue === item.value}
                            onClick={onSelect}
                        />
                    ))}
                </div>
            </div>

            {/*PER_PLOT_FIELDS*/}
            <div className="layout-variable-panel__section">
                <h3 className="layout-variable-panel__section-title">{t('Per-plot settings')}</h3>
                <div className="layout-variable-panel__divider" />
                {PER_PLOT_FIELDS.map((item) => (
                    <SubplotButtonRow
                        key={item.field}
                        field={item.field}
                        label={item.label}
                        availableNumbers={availableNumbers}
                        currentValue={currentValue}
                        onSelect={onSelect}
                    />
                ))}
            </div>

            {/*OVERLAY_FIELDS*/}
            <div className="layout-variable-panel__section">
                <p style={{ color: '#c1c1c1', textTransform: 'none' }} className="layout-variable-panel__section-title">
                    {t('Overlay on Main/Secondary/Auto-scaled Axis')}
                </p>
                {OVERLAY_FIELDS.map((item) => (
                    <SubplotButtonRow
                        key={item.field}
                        field={item.field}
                        label={item.label}
                        disabled={item.field === 'main' && isMainDisabled}
                        availableNumbers={availableNumbers}
                        currentValue={currentValue}
                        onSelect={onSelect}
                    />
                ))}
            </div>

            {/*COLOR_FIELDS*/}
            <div className="layout-variable-panel__section">
                <p style={{ color: '#c1c1c1', textTransform: 'none' }} className="layout-variable-panel__section-title">
                    {t('Color by category')}
                </p>
                {COLOR_FIELDS.map((item) => (
                    <SubplotButtonRow
                        key={item.field}
                        field={item.field}
                        label={item.label}
                        availableNumbers={availableNumbers}
                        currentValue={currentValue}
                        onSelect={onSelect}
                    />
                ))}
            </div>
        </div>
    );
}
