import GroupButton from '@/shared/components/ui/GroupButton.tsx';

const SwitchList = ['base', 's', 'm', 'l', 'xl'];
const labels = ['Base', 'S', 'M', 'L', 'XL'];

interface Props {
    fontSizeValue?: string;
    onChange?: (fontSizeValue: string) => void;
    disabled?: boolean;
}

export default function FontSizeBlock({ fontSizeValue, onChange, disabled }: Props) {
    return (
        <GroupButton
            group={SwitchList}
            activeValue={fontSizeValue}
            labels={labels}
            disabled={disabled}
            onChange={(active) => {
                onChange?.(active);
            }}
        />
    );
}
