export function isActiveReactContainer(container: Element | null): boolean {
    if (!container) return false;
    if (container.isConnected) return true;

    const row = container.closest<HTMLLIElement>('li[data-virtual-row]');
    const owner = row?._virtualListOwner;
    return owner?.isConnected === true && owner.dataset.virtualized === 'true';
}
