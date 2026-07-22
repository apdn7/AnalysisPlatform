import React, { type ReactNode } from 'react';
import { Button } from 'react-bootstrap';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    body: ReactNode;
    onClose: () => void;
    onConfirm: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    confirmDisabled?: boolean;
    id?: string;
}

export default function ConfirmModal({
    isOpen,
    title,
    body,
    onClose,
    onConfirm,
    confirmLabel = 'OK',
    cancelLabel = 'Cancel',
    confirmDisabled = false,
    id = 'confirmModal',
}: ConfirmModalProps) {
    if (!isOpen) return null;

    return (
        <div id="confirmModal" className="modal fade show d-block" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
            <div className="modal-dialog" id={id}>
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title">{title}</h5>
                        <button type="button" className="close" onClick={onClose} aria-label="Close">
                            <span>&times;</span>
                        </button>
                    </div>
                    <div className="modal-body">{body}</div>
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
