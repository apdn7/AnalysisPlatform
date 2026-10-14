import GroupButton from '@/shared/components/ui/GroupButton.tsx';

const SwitchList = ['dark', 'light'];

interface Props {
    themeValue?: string;
    onChange?: (themeValue: string) => void;
}
export default function ThemeBlock({ themeValue, onChange }: Props) {
    return (
        <div className="ml-3">
            <GroupButton
                group={SwitchList}
                activeValue={themeValue}
                onChange={(active) => {
                    onChange?.(active);
                }}
            />
        </div>
    );
}
