declare global {
    interface Window {
        toastr: any;
    }
}

declare const toastr: any;

export const useToast = () => {
    const getToastr = () => {
        const toastObj = typeof window !== 'undefined' ? window.toastr : typeof toastr !== 'undefined' ? toastr : null;
        if (toastObj) {
            toastObj.options = {
                closeButton: true,
                debug: false,
                newestOnTop: true,
                progressBar: true,
                positionClass: 'toast-bottom-right',
                onclick: null,
                showDuration: 500,
                hideDuration: 200,
                timeOut: 10000,
                extendedTimeOut: 500,
                showEasing: 'swing',
                hideEasing: 'linear',
                showMethod: 'fadeIn',
                hideMethod: 'fadeOut',
                onHidden: () => {
                    const toastLength = document.getElementsByClassName('toast').length;
                    if (toastLength <= 1) {
                        toastObj.clear();
                    }
                },
            };
        }
        return toastObj;
    };

    const success = (msg: string, title?: string) => {
        const t = getToastr();
        if (t) t.info(msg, title);
    };

    const error = (msg: string, title?: string) => {
        const t = getToastr();
        if (t) t.error(msg, title);
    };

    const warning = (msg: string, title?: string) => {
        const t = getToastr();
        if (t) t.warning(msg, title);
    };

    const closeAllToast = () => {
        // do not show Clear All if existing
        if (document.getElementsByClassName('close-all-toast').length > 0) return;

        const t = getToastr();
        if (!t) return;

        t.options = {
            closeButton: true,
            debug: false,
            newestOnTop: false,
            progressBar: true,
            positionClass: 'toast-top-full-width',
            onclick: () => {
                t.clear();
            },
            showIcon: false,
            showDuration: 0,
            hideDuration: 0,
            timeOut: 0,
            extendedTimeOut: 0,
            showEasing: 'swing',
            hideEasing: 'linear',
            showMethod: 'fadeIn',
            hideMethod: 'fadeOut',
        };

        return t.info('CLOSE ALL').addClass('close-all-toast');
    };

    return {
        success,
        error,
        warning,
        closeAllToast,
        clear: () => getToastr()?.clear(),
    };
};
