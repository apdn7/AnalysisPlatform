import React, { type ReactNode } from 'react';
import { Button } from 'react-bootstrap';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    children: ReactNode;
    onClose: () => void;
    onConfirm: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    confirmDisabled?: boolean;
    id?: string;
    maxWidth?: number;
}

export default function ConfirmModal({
    isOpen,
    title,
    children,
    onClose,
    onConfirm,
    confirmLabel = 'OK',
    cancelLabel = 'Cancel',
    confirmDisabled = false,
    id = 'confirmModal',
    maxWidth,
}: ConfirmModalProps) {
    if (!isOpen) return null;

    return (
        <div className="modal fade show d-block" data-layout-ui style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
            <div className="modal-dialog" id={id} style={{ maxWidth, margin: '1.75rem auto' }}>
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title">{title}</h5>
                        <button type="button" className="close" onClick={onClose} aria-label="Close">
                            <span>&times;</span>
                        </button>
                    </div>
                    <div className="modal-body" style={{ whiteSpace: 'break-spaces' }}>
                        {children}
                    </div>
                    <div className="modal-footer">
                        <Button
                            className="btn-primary"
                            id="registerConfirmButton"
                            onClick={onConfirm}
                            disabled={confirmDisabled}
                        >
                            {confirmLabel}
                        </Button>
                        <Button variant="secondary" id="registerCancelButton" onClick={onClose}>
                            {cancelLabel}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
