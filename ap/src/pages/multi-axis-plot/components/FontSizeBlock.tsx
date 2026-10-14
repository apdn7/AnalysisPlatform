import GroupButton from '@/shared/components/ui/GroupButton.tsx';

const SwitchList = ['base', 's', 'm', 'l', 'xl'];
const labels = ['Base', 'S', 'M', 'L', 'XL'];

interface Props {
    fontSizeValue?: string;
    onChange?: (fontSizeValue: string) => void;
}

export default function FontSizeBlock({ fontSizeValue, onChange }: Props) {
    return (
        <GroupButton
            group={SwitchList}
            activeValue={fontSizeValue}
            labels={labels}
            onChange={(active) => {
                onChange?.(active);
            }}
        />
    );
}
