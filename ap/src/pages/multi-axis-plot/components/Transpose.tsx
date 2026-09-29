import SwitchButton from '@/shared/components/ui/SwitchButton.tsx';

interface Props {
    transposeValue: boolean;
    onChange?: (transposeValue: boolean) => void;
}

export default function Transpose({ transposeValue, onChange }: Props) {
    return (
        <SwitchButton
            id="multi-axis-plot-transpose"
            label="Transpose"
            title="MAP transpose hover ms"
            isChecked={transposeValue}
            onChange={onChange}
        />
    );
}
