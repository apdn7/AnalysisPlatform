import GroupButton from '@/shared/components/ui/GroupButton.tsx';

const SwitchList = ['dark', 'light'];

interface Props {
    themeValue?: string;
    onChange?: (themeValue: string) => void;
    disabled?: boolean;
}

export default function ThemeBlock({ themeValue, onChange, disabled }: Props) {
    return (
        <div className="ml-3">
            <GroupButton
                group={SwitchList}
                activeValue={themeValue}
                disabled={disabled}
                onChange={(active) => {
                    onChange?.(active);
                }}
            />
        </div>
    );
}
