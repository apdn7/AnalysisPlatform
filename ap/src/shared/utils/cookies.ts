type CookieValue = string | number | Date | undefined;

export const docCookies = {
    getItem(sKey: string): string {
        try {
            return decodeURIComponent(
                document.cookie.replace(
                    new RegExp(
                        `(?:(?:^|.*;)\\s*${encodeURIComponent(sKey).replace(/[\-\.\+\*]/g, '\\$&')}\\s*\\=\\s*([^;]*).*$)|^.*$`,
                    ),
                    '$1',
                ),
            );
        } catch {
            return '';
        }
    },

    setItem(
        sKey: string,
        sValue: string,
        vEnd?: CookieValue,
        sPath?: string,
        sDomain?: string,
        bSecure?: boolean,
    ): boolean {
        if (!sKey || /^(?:expires|max\-age|path|domain|secure)$/i.test(sKey)) {
            return false;
        }

        let sExpires = '';

        if (vEnd) {
            if (typeof vEnd === 'number') {
                sExpires = vEnd === Infinity ? '; expires=Fri, 31 Dec 9999 23:59:59 GMT' : `; max-age=${vEnd}`;
            } else if (typeof vEnd === 'string') {
                sExpires = `; expires=${vEnd}`;
            } else if (vEnd instanceof Date) {
                sExpires = `; expires=${vEnd.toUTCString()}`;
            }
        }

        document.cookie = `${encodeURIComponent(sKey)}=${encodeURIComponent(
            sValue,
        )}${sExpires}${sDomain ? `; domain=${sDomain}` : ''}; path=/${bSecure ? '; secure' : ''}`;

        return true;
    },

    removeItem(sKey: string, sPath?: string, sDomain?: string): boolean {
        if (!sKey || !this.hasItem(sKey)) return false;

        document.cookie = `${encodeURIComponent(sKey)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT${
            sDomain ? `; domain=${sDomain}` : ''
        }; path=/`;

        return true;
    },

    hasItem(sKey: string): boolean {
        return new RegExp(`(?:^|;\\s*)${encodeURIComponent(sKey).replace(/[\-\.\+\*]/g, '\\$&')}\\s*\\=`).test(
            document.cookie,
        );
    },

    getLocale(): string {
        return this.getItem(keyPort('locale')) || 'en';
    },

    isJaLocale(): boolean {
        return this.getLocale() === 'ja';
    },
};
