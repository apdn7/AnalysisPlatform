/* eslint-disable no-restricted-syntax */
/* eslint-disable no-shadow */
/* eslint-disable no-param-reassign */
/* eslint-disable no-mixed-operators */
/* eslint-disable no-bitwise */
/* eslint-disable object-shorthand */
/* eslint-disable no-useless-escape */
/* eslint-disable default-case */
/* eslint-disable max-len */
/* eslint-disable no-unused-expressions */
/* eslint-disable func-names */
/* eslint-disable no-unused-vars */

const SQL_LIMIT = 50000;

const DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';

const COMMON_CONSTANT = {
    NA: 'NA',
    EN_DASH: '–',
};

const MESSAGE_LEVEL = {
    WARN: 'WARN',
    ERROR: 'ERROR',
    INFO: 'INFO',
};

const scaleOptionConst = {
    SETTING: '1',
    COMMON: '2',
    THRESHOLD: '3',
    AUTO: '4',
    FULL_RANGE: '5',
};

// facet level definition
const facetLevels = {
    LV_1: '1',
    LV_2: '2',
    DIV: '3',
    UNSET: '',
};

const CYCLIC_TERM = {
    INTERVAL: 'cyclicTermInterval',
    WINDOW_LENGTH: 'cyclicTermWindowLength',
    DIV_NUM: 'cyclicTermDivNum',
    INTERVAL_MIN_MAX: {
        MIN: -720,
        MAX: 720,
        DEFAULT: 0.1,
    },
    WINDOW_LENGTH_MIN_MAX: {
        MIN: 0.1,
        MAX: 20000,
        DEFAULT: 1,
    },
    DIV_NUM_MIN_MAX: {
        MIN: 2,
        MAX: 150,
        DEFAULT: 30,
    },
};

const START_DATE = 'START_DATE';
const START_TIME = 'START_TIME';
const END_DATE = 'END_DATE';
const END_TIME = 'END_TIME';
const COMMON = 'COMMON';
const CONDT = 'cond_procs';
const FILTER_PARTNO = 'filter-partno';
const FILTER_LINE = 'filter-line-machine-id';
const FILTER_MACH = 'machine_id_multi';
const FILTER_OTHER = 'filter-other';

const trimLeft = target => target.replace(new RegExp(/^[\s]+/), '');

const trimRight = target => target.replace(new RegExp(/[\s]+$/), '');

const trimMid = target => target.replace(new RegExp(/\s+/), ' ');

const trimBoth = target => trimLeft(trimRight(trimMid(target)));

const isEmpty = (val) => {
    if (!val) { // null or undefined or ''(空文字) or 0 or false
        if (val !== 0 && val !== false) {
            return true;
        }
    } else if (typeof val === 'object') { // array or object
        return Object.keys(val).length === 0;
    }
    return false; // 値は空ではない
};

const isNumericDatatype = (type) => {
    const NUMERIC_TYPE = ['int', 'num', 'real', 'float', 'double', 'long', 'dec', 'bit', 'money'];
    if (!type) return false;
    // convert to lower case before compare
    const lowerType = type.toLowerCase();
    for (let i = 0; i < NUMERIC_TYPE.length; i++) {
        if (lowerType.includes(NUMERIC_TYPE[i])) {
            return true;
        }
    }
    return false;
};

const docCookies = {
    getItem(sKey) {
        try {
            return decodeURIComponent(document.cookie.replace(new RegExp(`(?:(?:^|.*;)\\s*${encodeURIComponent(sKey).replace(/[\-\.\+\*]/g, '\\$&')}\\s*\\=\\s*([^;]*).*$)|^.*$`), '$1')) || 'ja';
        } catch (e) {
            return 'ja';
        }
    },
    setItem(sKey, sValue, vEnd, sPath, sDomain, bSecure) {
        if (!sKey || /^(?:expires|max\-age|path|domain|secure)$/i.test(sKey)) {
            return false;
        }
        let sExpires = '';
        if (vEnd) {
            switch (vEnd.constructor) {
            case Number:
                sExpires = vEnd === Infinity ? '; expires=Fri, 31 Dec 9999 23:59:59 GMT' : `; max-age=${vEnd}`;
                break;
            case String:
                sExpires = `; expires=${vEnd}`;
                break;
            case Date:
                sExpires = `; expires=${vEnd.toUTCString()}`;
                break;
            }
        }
        document.cookie = `${encodeURIComponent(sKey)}=${encodeURIComponent(sValue)}${sExpires}${sDomain ? `; domain=${sDomain}` : ''}; path=/${bSecure ? '; secure' : ''}`;
        return true;
    },
    removeItem(sKey, sPath, sDomain) {
        if (!sKey || !this.hasItem(sKey)) {
            return false;
        }
        document.cookie = `${encodeURIComponent(sKey)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT${sDomain ? `; domain=${sDomain}` : ''}; path=/`;
        return true;
    },
    hasItem(sKey) {
        return (new RegExp(`(?:^|;\\s*)${encodeURIComponent(sKey).replace(/[\-\.\+\*]/g, '\\$&')}\\s*\\=`)).test(document.cookie);
    },
    keys: /* optional method: you can safely remove it! */ function () {
        const aKeys = document.cookie.replace(/((?:^|\s*;)[^\=]+)(?=;|$)|^\s*|\s*(?:\=[^;]*)?(?:\1|$)/g, '').split(/\s*(?:\=[^;]*)?;\s*/);
        for (let nIdx = 0; nIdx < aKeys.length; nIdx++) {
            aKeys[nIdx] = decodeURIComponent(aKeys[nIdx]);
        }
        return aKeys;
    },
};

// get or create node from object
const getOrCreateNewObj = (node, key, val = {}) => {
    if (!(key in node)) {
        node[key] = val;
    }
    return node[key];
};

// get or create node from object using array of keys
const getOrCreateNodeByKeys = (dictObj, keys, defaultVal = undefined) => {
    let node = dictObj;
    // eslint-disable-next-line no-restricted-syntax
    for (const key of keys) {
        // if key is a number , result will be wrong.
        // because it get a element in array instead a key in dictionary
        if (Array.isArray(node)) {
            return defaultVal;
        }

        if (node !== undefined && node !== null && typeof (node) === 'object') {
            if (node[key] === undefined) {
                node[key] = {};
            }
            node = node[key];
        } else {
            return defaultVal;
        }
    }
    return node;
};

// generate random string of length `len`
const generateRandomString = len => 'x'.repeat(len).replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const
        v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
});

const isArrayDuplicated = (array) => {
    if (!Array.isArray(array)) return false;
    return new Set(array).size !== array.length;
};

const findIndexes = (arr1, arr2) => {
    if (!arr1 || !arr2) return [];
    const output = [];
    arr1.forEach(e => output.push(arr2.indexOf(e)));
    return output;
};

const getValueByIndexes = (indexes, targetArray, atlArray) => {
    if (!indexes) return [];
    const output = [];
    indexes.forEach(idx => output.push(targetArray[idx] || atlArray[idx]));
    return output;
};

const DEFAULT_LOCALE = 'ja';

$(() => {
    // show selected locale for pages
    const locale = docCookies.getItem('locale');
    // console.log(locale);
    $('#select-language').val(locale);

    // change locale and reload current page
    $('#select-language').change(function changeLocal() {
        let selectedLocale = $(this).children('option:selected').val();
        if (selectedLocale) {
            docCookies.setItem('locale', selectedLocale);
            const locale = docCookies.getItem('locale');
        } else {
            selectedLocale = DEFAULT_LOCALE;
        }
        $('#select-language').val(selectedLocale);
        window.location.reload(true);
    });

    // press ESC to collapse floating dropdown
    document.addEventListener('keyup', keyPress);
});

// validate number
const validateNumber = (element) => {
    const setInputFilter = (textbox, inputFilter, afterOKCheckFn = null) => {
        ['input', 'keydown', 'keyup', 'mousedown', 'mouseup', 'select', 'contextmenu', 'drop'].forEach((eventStr) => {
            textbox.on(eventStr, (event) => {
                const replaceVal = /[０-９]/g;
                event.currentTarget.value = event.currentTarget.value.replace('．', '.');
                event.currentTarget.value = event.currentTarget.value.replace(replaceVal,
                    s => String.fromCharCode(s.charCodeAt(0) - 65248)); // replace ０-９ to 0-9
                // 全角英数の文字コードから65248個前が半角英数の文字コード

                if (inputFilter(event.currentTarget.value)) { // set new value input
                    event.currentTarget.oldValue = event.currentTarget.value;
                    event.currentTarget.oldSelectionStart = event.currentTarget.selectionStart;
                    event.currentTarget.oldSelectionEnd = event.currentTarget.selectionEnd;

                    // チェックOKの場合は、Callbackを呼び出す。
                    if (afterOKCheckFn != null) {
                        afterOKCheckFn();
                    }
                    // eslint-disable-next-line no-prototype-builtins
                } else if (event.currentTarget.hasOwnProperty('oldValue')) { // keep old value input
                    event.currentTarget.value = event.currentTarget.oldValue;
                    event.currentTarget.setSelectionRange(event.currentTarget.oldSelectionStart,
                        event.currentTarget.oldSelectionEnd);
                } else {
                    event.currentTarget.value = '';
                }
            });
        });
    };
    setInputFilter(element, value => /^\d*\d*$/.test(value));
};

const validatCyclicRealOnInput = (element) => {
    // allow one decimal point only
    setInputFilter(element, value => /^-?\d*\.?(\d)?$/.test(value) || value === '');
};

const setInputFilter = (textbox, inputFilter, afterOKCheckFn = null) => {
    ['input', 'keydown', 'keyup', 'mousedown', 'mouseup', 'select', 'contextmenu', 'drop'].forEach((eventStr) => {
        textbox.on(eventStr, (event) => {
            const replaceVal = /[０-９]/g;
            event.currentTarget.value = event.currentTarget.value.replace('．', '.');
            event.currentTarget.value = event.currentTarget.value.replace(replaceVal,
                s => String.fromCharCode(s.charCodeAt(0) - 65248)); // replace ０-９ to 0-9
            // 全角英数の文字コードから65248個前が半角英数の文字コード

            if (inputFilter(event.currentTarget.value)) { // set new value input
                event.currentTarget.oldValue = event.currentTarget.value;
                event.currentTarget.oldSelectionStart = event.currentTarget.selectionStart;
                event.currentTarget.oldSelectionEnd = event.currentTarget.selectionEnd;

                // チェックOKの場合は、Callbackを呼び出す。
                if (afterOKCheckFn != null) {
                    afterOKCheckFn();
                }
                // eslint-disable-next-line no-prototype-builtins
            } else if (event.currentTarget.hasOwnProperty('oldValue')) { // keep old value input
                event.currentTarget.value = event.currentTarget.oldValue;
                event.currentTarget.setSelectionRange(event.currentTarget.oldSelectionStart,
                    event.currentTarget.oldSelectionEnd);
            } else {
                event.currentTarget.value = '';
            }
        });
    });
};

const validateTargetPeriodInput = () => {
    // allow only integer for number of ridge lines
    validateNumber($(`#${CYCLIC_TERM.DIV_NUM}`));

    // allow only real for window length
    validatCyclicRealOnInput($(`#${CYCLIC_TERM.WINDOW_LENGTH}`));

    // allow only real for interval
    validatCyclicRealOnInput($(`#${CYCLIC_TERM.INTERVAL}`));
};

// validate coef
const validateCoefOnInput = (element) => {
    setInputFilter(element, value => /^-?\d*\.?\d*$/.test(value) || value === '');
};

const validateRecentTimeInterval = (element) => {
    // allow number only for latest time interval
    validateCoefOnInput(element);

    // allow value > 0 only for latest time interval
    element.on('change', (event) => {
        const newValue = event.target.value;
        const { currentVal } = event.target.dataset;
        if (newValue <= 0) {
            event.target.value = currentVal || '';
        } else {
            event.target.dataset.currentVal = newValue;
        }
    });
};

const stringNormalization = (val) => {
    if (typeof (val) !== 'string') {
        return val;
    }

    let newVal = val;
    // normalization
    newVal = newVal.normalize('NFKC');

    // trim space
    newVal = trimBoth(newVal);

    // replace
    newVal = newVal.replace('°C', '℃');
    newVal = newVal.replace('°F', '℉');

    return newVal;
};

// convert input textbox element from Zenkaku to Hankaku on specific event
const handleInputTextZenToHanEvent = (event, afterOKCheckFn = null, callbackParams = null) => {
    event.currentTarget.value = stringNormalization(event.currentTarget.value);
    event.currentTarget.oldValue = event.currentTarget.value;
    event.currentTarget.oldSelectionStart = event.currentTarget.selectionStart;
    event.currentTarget.oldSelectionEnd = event.currentTarget.selectionEnd;

    // チェックOKの場合は、Callbackを呼び出す。
    if (afterOKCheckFn != null) {
        afterOKCheckFn(callbackParams);
    }
};

const setInputFilterH2Z = (element, unbind = false, ignoreWithAttr = []) => {
    for (const attr of ignoreWithAttr) {
        if (element.attr(attr)) {
            return;
        }
    }
    ['change'].forEach((eventName) => {
        if (unbind) {
            element.unbind(eventName);
        }
        element.on(eventName, handleInputTextZenToHanEvent);
    });
};

const assignValueToSelect2 = (select2Element, val) => {
    if (isEmpty(val)) return;
    if (typeof (val) === 'object') val = val.join(' ');
    let words = [val];
    const isMultipleselect2 = select2Element.attr('multiple');
    if (isMultipleselect2) {
        words = val.split(/[ ]+/);
        words = [...new Set(words)];
    }
    const matchOptions = [];
    for (const word of words) {
        if (!isEmpty(word)) {
            const found = select2Element.find('option').filter((i, e) => $(e).val() === word).length;
            if (!found) {
                const newOption = new Option(word, word, false, false);
                select2Element.append(newOption).trigger('change');
            }
            matchOptions.push(word);
        }
    }
    select2Element.val(null).val(matchOptions).trigger('change');
};


const handleInputTextZenToHanEventSelect2 = (element) => {
    let val = element.val();
    if (typeof (val) !== 'object') {
        val = [val];
    }
    val = val.join(' ');
    val = stringNormalization(val);
    assignValueToSelect2(element, val);
};

const setInputFilterH2ZSelect2 = (element, unbind = false) => {
    ['select2:close'].forEach((eventName) => {
        if (unbind) {
            element.unbind(eventName);
        }
        element.on(eventName, () => {
            handleInputTextZenToHanEventSelect2(element);
        });
    });
};

// convert input textbox element from Zenkaku to Hankaku on many events
const convertTextH2Z = (parent = null) => {
    let eles;
    if (parent) {
        eles = $(parent);
    } else {
        eles = $(document);
    }

    const alreadyConvertClass = '.already-convert-hankaku';
    eles.find('input, textarea').not(alreadyConvertClass).each(function () {
        if ($(this).attr('type') !== 'file') {
            setInputFilterH2Z($(this), false, ['multiple']);
            $(this).addClass(alreadyConvertClass.substr(1));
        }
    });

    eles.find('select').not(alreadyConvertClass).each(function () {
        const thisElement = $(this);
        if (thisElement.hasClass('convert-h2z')) {
            setInputFilterH2ZSelect2(thisElement, true);
            thisElement.addClass(alreadyConvertClass.substr(1));
        }
    });
};


// convert fullwidth special symbols to halfwidth katakana
// const replaceStringByArrayOfIndex = (str, src, dest) => {
//     const len = src.length;
//     for (let i = 0; i < len; i++) {
//         str = replaceAll(str, src[i], dest[i]);
//     }
//     return str;
// };

// const replaceAll = (target, from, to) => {
//     if (target.indexOf(from) < 0) {
//         return target;
//     }
//     return target.split(from).join(to);
// };

// const convertSymbolF2H = str => replaceStringByArrayOfIndex(str, F_SYMBOL, H_SYMBOL);

// const H_SYMBOL = new Array(
//     ',', '.', ':', ';', '!', '?', '"', "'", '`', '^', '~', '¯', '_',
//     '&', '@', '#', '%', '+', '-', '*', '=', '<', '>', '(', ')', '[', ']',
//     '{', '}', '(', ')', '|', '¦', '/', '\\', '¬', '$', '£', '¢', '₩', '¥', '｢', '｣',
// );

// const F_SYMBOL = new Array(
//     '，', '．', '：', '；', '！', '？', '＂', '＇', '｀', '＾', '～', '￣', '＿',
//     '＆', '＠', '＃', '％', '＋', '－', '＊', '＝', '＜', '＞', '（', '）', '［', '］',
//     '｛', '｝', '｟', '｠', '｜', '￤', '／', '＼', '￢', '＄', '￡', '￠', '￦', '￥', '「', '」',
// );
//
// const EnclosedNumbers = new Array('⓪', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨');
// const UnicodeNumber = new Array('0', '1', '2', '3', '4', '5', '6', '7', '8', '9');
//
// // convert half-width katakana to full-width katakana
// const convertKanaH2F = str => replaceStringByArrayOfIndex(str, H_KANA, F_KANA);
// const convertEnclosedNumber = str => replaceStringByArrayOfIndex(str, EnclosedNumbers, UnicodeNumber);
//
// const H_KANA = [
//     'ｶﾞ', 'ｷﾞ', 'ｸﾞ', 'ｹﾞ', 'ｺﾞ', 'ｻﾞ', 'ｼﾞ', 'ｽﾞ', 'ｾﾞ', 'ｿﾞ',
//     'ﾀﾞ', 'ﾁﾞ', 'ﾂﾞ', 'ﾃﾞ', 'ﾄﾞ', 'ﾊﾞ', 'ﾋﾞ', 'ﾌﾞ', 'ﾍﾞ', 'ﾎﾞ', 'ｳﾞ', // 濁音
//     'ﾊﾟ', 'ﾋﾟ', 'ﾌﾟ', 'ﾍﾟ', 'ﾎﾟ', // 半濁音
//     'ｧ', 'ｨ', 'ｩ', 'ｪ', 'ｫ', 'ｬ', 'ｭ', 'ｮ', 'ｯ', 'ｰ', 'ﾜ', // 小文字
//     'ｱ', 'ｲ', 'ｳ', 'ｴ', 'ｵ', 'ｶ', 'ｷ', 'ｸ', 'ｹ', 'ｺ', // 50音
//     'ｻ', 'ｼ', 'ｽ', 'ｾ', 'ｿ', 'ﾀ', 'ﾁ', 'ﾂ', 'ﾃ', 'ﾄ',
//     'ﾅ', 'ﾆ', 'ﾇ', 'ﾈ', 'ﾉ', 'ﾊ', 'ﾋ', 'ﾌ', 'ﾍ', 'ﾎ',
//     'ﾏ', 'ﾐ', 'ﾑ', 'ﾒ', 'ﾓ', 'ﾔ', 'ﾕ', 'ﾖ',
//     'ﾗ', 'ﾘ', 'ﾙ', 'ﾚ', 'ﾛ', 'ﾜ', 'ｲ', 'ｦ', 'ｴ', 'ﾝ', // 50音
// ];
//
// const F_KANA = ['ガ', 'ギ', 'グ', 'ゲ', 'ゴ', 'ザ', 'ジ', 'ズ', 'ゼ', 'ゾ',
//     'ダ', 'ヂ', 'ヅ', 'デ', 'ド', 'バ', 'ビ', 'ブ', 'ベ', 'ボ', 'ヴ', // 濁音
//     'パ', 'ピ', 'プ', 'ペ', 'ポ', // 半濁音
//     'ァ', 'ィ', 'ゥ', 'ェ', 'ォ', 'ャ', 'ュ', 'ョ', 'ッ', 'ー', 'ヮ', // 小文字
//     'ア', 'イ', 'ウ', 'エ', 'オ', 'カ', 'キ', 'ク', 'ケ', 'コ', // 50音
//     'サ', 'シ', 'ス', 'セ', 'ソ', 'タ', 'チ', 'ツ', 'テ', 'ト',
//     'ナ', 'ニ', 'ヌ', 'ネ', 'ノ', 'ハ', 'ヒ', 'フ', 'ヘ', 'ホ',
//     'マ', 'ミ', 'ム', 'メ', 'モ', 'ヤ', 'ユ', 'ヨ',
//     'ラ', 'リ', 'ル', 'レ', 'ロ', 'ワ', 'ヰ', 'ヲ', 'ヱ', 'ン', // 50音
// ];
//
// const removeUnexpectedChars = (str) => {
//     const acceptChars = [' ', ...H_KANA, ...F_KANA, ...H_SYMBOL, ...F_SYMBOL, ...EnclosedNumbers, ...UnicodeNumber];
//     const alphabets = new RegExp(/[0-9a-zA-Z０-９ａ-ｚＡ-Ｚ\u3040-\u309f\u4e00-\u9faf\u3400-\u4dbf]+/g);
//
//     let res = '';
//     [...str].forEach((char) => {
//         if (acceptChars.includes(char) || char.match(alphabets)) {
//             res += char;
//         }
//     });
//     return res;
// };


// gen Json for Db Config Data
const genJsonfromHTML = (searchFromHtml, jsonRootKey, valAlwaysArray = false) => {
    const result = {};
    const parentHtml = typeof (searchFromHtml) === 'string' ? $(`${searchFromHtml}`) : searchFromHtml;

    if (parentHtml.length === 1) {
        // root value is a json
        result[jsonRootKey] = {};
    } else {
        // root value is an array
        result[jsonRootKey] = [...Array(parentHtml.length)].map(() => JSON.parse('{}'));
    }

    // closure
    const inner = (searchHtmlName, getHtmlValFunc = null, jsonKey = searchHtmlName) => {
        // loop parent HTML elements
        parentHtml.each((i, parentEle) => {
            const vals = [...parentEle.querySelectorAll(`[name=${searchHtmlName}]`)].map(e => (getHtmlValFunc === null ? e.value : getHtmlValFunc(e)));
            // const vals = [...$(parentEle).find(`[name=${searchHtmlName}]`)].map(e => (getHtmlValFunc === null ? e.value : getHtmlValFunc(e)));

            let val;
            switch (vals.length) {
            case 0:
                val = null;
                break;
            case 1:
                val = valAlwaysArray ? [...vals] : vals[0];
                break;
            default:
                val = [...vals];
            }

            // set value to root json
            if (parentHtml.length === 1) {
                result[jsonRootKey][jsonKey] = val;
            } else {
                result[jsonRootKey][i][jsonKey] = val;
            }
        });
        return result;
    };

    return inner;
};


// get node from dictionary
const getNode = (dictObj, keys, defaultVal = null) => {
    let node = dictObj;
    // eslint-disable-next-line no-restricted-syntax
    for (const key of keys) {
        // if key is a number , result will be wrong.
        // because it get a element in array instead a key in dictionary
        if (Array.isArray(node)) {
            return defaultVal;
        }

        if (node && typeof (node) === 'object') {
            node = node[key];
            // node is not a dictionary
            if (node === undefined) return defaultVal;
        } else {
            return defaultVal;
        }
    }

    return node;
};

// display message after press register buttons
const displayRegisterMessage = (alertID, flaskMessage = { message: '', is_error: false, is_warning: false }) => {
    if (alertID === null || alertID === undefined) return;
    $(`${alertID}-content`).html(flaskMessage.message);
    const alert = $(`${alertID}`);
    alert.removeClass('show');
    alert.removeClass('alert-success');
    alert.removeClass('alert-danger');
    alert.removeClass('alert-warning');
    if (flaskMessage.is_warning) {
        alert.css('display', 'block');
        alert.addClass('show alert-warning');
    } else if (!flaskMessage.is_error) {
        alert.css('display', 'block');
        alert.addClass('show alert-success');
    } else if (flaskMessage.is_error) {
        alert.css('display', 'block');
        alert.addClass('show alert-danger');
    }
    // setTimeout(() => {
    //     alert.css('display', 'none');
    // }, 5000);
};

const hideAlertMessages = () => {
    $('.alert.alert-dismissible.fade.show').css('display', 'none');
};

// delete closest element
const delClosestEle = (e, closestEle) => {
    const tableEle = $(e).closest('table');
    e.closest(closestEle).remove();
    updateTableRowNumber(null, tableEle);
};

const sidebarEles = {
    sid: '#sidebar',
    sidebarIds: '#sidebar, #content',
    collapseIn: '.collapse.in',
    aExpanded: 'a[aria-expanded=true]',
    dropdownToggle: '.side-dropdown-toggle',
    parentEles: 'span.nav-text, .sidebar-header a, .logo-header',
    ulList: 'ul.list-unstyled',
    cfgSm: 'cfgSm',
    sidebarCollapseId: '#sidebarCollapse',
    collapse: '.collapse',
};

const sidebarCollapse = () => {
    // toggle attribute plugin jquery
    $.fn.toggleAttr = function (attr, value) {
        return this.each(function () {
            const $this = $(this);
            $this.attr(attr) ? $this.removeAttr(attr) : $this.attr(attr, value);
        });
    };
    $(sidebarEles.sidebarIds).toggleClass('active');
    $(sidebarEles.collapseIn).toggleClass('in');
    // Set collapse for submenu
    $(sidebarEles.aExpanded).attr('aria-expanded', 'false');
    $(sidebarEles.dropdownToggle).toggleClass('noafter');
    $(sidebarEles.parentEles).toggleClass('hide');

    $(sidebarEles.dropdownToggle).each((k, e) => {
        if ($(e).not('collapsed')) {
            $(e).addClass('collapsed');
        }
    });
    $(sidebarEles.ulList).removeClass('show');

    // trigger resize window
    window.dispatchEvent(new Event('resize'));
};

const isSidebarOpen = () => {
    if ($(sidebarEles.sidebarIds).hasClass('active')) {
        return false;
    }
    return true;
};

const menuCollapse = () => {
    setTimeout(() => {
        $('#sidebar .collapse.show').collapse('hide');
    }, 500);
};

const closeSidebar = () => {
    menuCollapse();
    if (isSidebarOpen()) {
        sidebarCollapse();
    }
};

const beforeShowGraphCommon = () => {
    closeSidebar();
    // update datetime all page
    updateDatetimeRange();
};

const fetchBackgroundJobs = (cb) => {
    fetch('/histview2/api/setting/job', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
    })
        .then(response => response.clone().json())
        .then((json) => {
            if (json) {
                cb(json);
            }
        })
        .catch(() => {
            //
        });
};

const runTime = () => new Date().getTime();

const DATE_FORMAT_TZ = 'YYYY-MM-DD HH:mm:ss Z';
const DATE_FORMAT_WITHOUT_TZ = 'YYYY-MM-DD HH:mm:ss';
const DATE_FORMAT = 'YYYY-MM-DD';
const DATE_PICKER_FORMAT = 'yy-mm-dd';
const DATE_FORMAT_VALIDATE = ['YYYY/MM/DD', 'YYYY/M/DD', 'YYYY/M/D', 'YYYY/M/DD',
    'YYYY-MM-DD', 'YYYY-M-DD', 'YYYY-M-DD', 'YYYY-M-D'];
const TIME_FORMAT = 'HH:mm';
const TIME_FORMAT_VALIDATE = ['HH:mm', 'H:mm', 'HH:m', 'H:m'];

const TRACE_TIME_CONST = {
    DEFAULT: 'default',
    RECENT: 'recent',
    FROM: 'from',
    TO: 'to',
};
const DATETIME_FORMAT_VALIDATE = DATE_FORMAT_VALIDATE.concat(
    [DATE_FORMAT_TZ, DATE_FORMAT_WITHOUT_TZ, DATE_FORMAT, DATE_PICKER_FORMAT],
);

// replace_date
const formatDate = dt => dt.replaceAll('\/', '-');

const formatDateTime = (dt, fm = DATE_FORMAT_WITHOUT_TZ) => moment.utc(dt).local().format(fm);

// formData is FormData object
const chooseTraceTimeInterval = (formData, traceTimeName = 'traceTime') => {
    if (!formData) return formData;

    const traceTimeOption = formData.get(traceTimeName) || TRACE_TIME_CONST.DEFAULT;

    if (!isEmpty(traceTimeOption) && traceTimeOption === TRACE_TIME_CONST.RECENT) {
        // unit is multiply of minute: minute=1, hour=60 (default), day=1440, week=10080
        const timeUnit = formData.get('timeUnit') || 60;
        const recentTimeInterval = formData.get('recentTimeInterval') || 24;

        if (!isEmpty(recentTimeInterval)) {
            const timeDiffMinute = Number(recentTimeInterval) * Number(timeUnit);
            const newStartDate = moment().add(-timeDiffMinute, 'minute').format(DATE_FORMAT);
            const newStartTime = moment().add(-timeDiffMinute, 'minute').format(TIME_FORMAT);
            const newEndDate = moment().format(DATE_FORMAT);
            const newEndTime = moment().format(TIME_FORMAT);

            formData.set('START_DATE', newStartDate);
            formData.set('START_TIME', newStartTime);
            formData.set('END_DATE', newEndDate);
            formData.set('END_TIME', newEndTime);
        }
    }
    return formData;
};

const convertFormDateTimeToUTC = (formData) => {
    // get all datetime
    const startDates = [...formData.getAll('START_DATE')];
    const startTimes = [...formData.getAll('START_TIME')];
    const endDates = [...formData.getAll('END_DATE')];
    const endTimes = [...formData.getAll('END_TIME')];

    // clear all datetimes before customize
    ['START_DATE', 'START_TIME', 'END_DATE', 'END_TIME'].forEach(e => formData.delete(e));

    // convert to UTC and re-assign
    startDates.forEach((e, i) => {
        const startUTCDt = toUTCDateTime(startDates[i], startTimes[i]);
        formData.append('START_DATE', startUTCDt.date);
        formData.append('START_TIME', startUTCDt.time);

        const endUTCDt = toUTCDateTime(endDates[i], endTimes[i]);
        if (endUTCDt.date) formData.append('END_DATE', endUTCDt.date);
        if (endUTCDt.time) formData.append('END_TIME', endUTCDt.time);
    });

    return formData;
};

// formData is FormData object
const chooseTraceTimeIntervals = (formData) => {
    const START_DATE = 'START_DATE';
    const START_TIME = 'START_TIME';
    const END_DATE = 'END_DATE';
    const END_TIME = 'END_TIME';
    if (!formData) return formData;
    // const traceTimes = [...formData.keys()].filter(e => e.startsWith(TRACE_TIME));
    const traceTimes = [...formData.keys()].filter(e => e.match(/.+TraceTime\d+/));
    const traceTimeOptions = traceTimes.map(e => formData.get(e));
    const recentTimeIntervals = formData.getAll('recentTimeInterval');
    const timeUnits = formData.getAll('timeUnit');

    // get all datetime
    const startDates = [...formData.getAll(START_DATE)];
    const startTimes = [...formData.getAll(START_TIME)];
    const endDates = [...formData.getAll(END_DATE)];
    const endTimes = [...formData.getAll(END_TIME)];

    // clear all datetimes before customize
    [START_DATE, START_TIME, END_DATE, END_TIME].forEach(e => formData.delete(e));

    traceTimeOptions.forEach((traceTimeOption, i) => {
        if (traceTimeOption === TRACE_TIME_CONST.RECENT) {
            const recentTimeInterval = recentTimeIntervals[i];
            const timeUnit = timeUnits[i];
            const timeDiffMinute = Number(recentTimeInterval) * Number(timeUnit);
            const newStartDate = moment().add(-timeDiffMinute, 'minute').format(DATE_FORMAT);
            const newStartTime = moment().add(-timeDiffMinute, 'minute').format(TIME_FORMAT);
            const newEndDate = moment().format(DATE_FORMAT);
            const newEndTime = moment().format(TIME_FORMAT);

            formData.append(START_DATE, newStartDate);
            formData.append(START_TIME, newStartTime);
            formData.append(END_DATE, newEndDate);
            formData.append(END_TIME, newEndTime);
        } else {
            formData.append(START_DATE, startDates[i]);
            formData.append(START_TIME, startTimes[i]);
            formData.append(END_DATE, endDates[i]);
            formData.append(END_TIME, endTimes[i]);
        }
    });
    return formData;
};


/* Binary search in JavaScript.
    * Returns the index of of the element in a sorted array or (-n-1)
    * where n is the insertion point for the new element.
    * Parameters:
    *     ar - A sorted array
    *     el - An element to search for
    *     compare_fn - A comparator function. The function takes two arguments: (a, b) and returns:
    *        a negative number  if a is less than b;
    *        0 if a is equal to b;
    *        a positive number of a is greater than b.
    * The array may contain duplicate elements. If there are more than one equal elements in the array,
    * the returned value can be the index of any one of the equal elements.
    */
const binarySearch = (ar, el, compareFn) => {
    let m = 0;
    let n = ar.length - 1;
    while (m <= n) {
        // eslint-disable-next-line no-bitwise
        const k = (n + m) >> 1;
        const cmp = compareFn(el, ar[k]);
        if (cmp > 0) {
            m = k + 1;
        } else if (cmp < 0) {
            n = k - 1;
        } else {
            return k;
        }
    }
    return m - 1;
};

function calculateNiceRange(minPoint, maxPoint, maxTicks = 10) {
    const range = niceNum(maxPoint - minPoint, false);
    const tickSpacing = niceNum(range / (maxTicks - 1), true);
    const niceMin = Math.floor(minPoint / tickSpacing) * tickSpacing;
    const niceMax = Math.ceil(maxPoint / tickSpacing) * tickSpacing;

    return {
        niceMin,
        niceMax,
        tickSpacing,
    };
}

function niceNum(localRange, round) {
    let niceFraction;
    /** nice, rounded fraction */

    const exponent = Math.floor(Math.log10(localRange));
    const fraction = localRange / (10 ** exponent);

    if (round) {
        if (fraction < 1.5) {
            niceFraction = 1;
        } else if (fraction < 3) {
            niceFraction = 2;
        } else if (fraction < 7) {
            niceFraction = 5;
        } else {
            niceFraction = 10;
        }
    } else if (fraction <= 1) {
        niceFraction = 1;
    } else if (fraction <= 2) {
        niceFraction = 2;
    } else if (fraction <= 5) {
        niceFraction = 5;
    } else {
        niceFraction = 10;
    }
    return niceFraction * (10 ** exponent);
}


function getPrecision(n) {
    let loggedPrecision = 1 - Math.floor(Math.log(Math.abs(n % 1))) / Math.log(10);
    loggedPrecision = Math.round(loggedPrecision);
    if (Number.isFinite(loggedPrecision)) {
        return loggedPrecision;
    }

    return 0;
}

// when user drag and drop items in tables -> save orders to db
const saveOrderToDB = (orderName, rowOrders = {}) => {
    $.ajax({
        url: `/histview2/api/setting/save_order/${orderName}`,
        data: JSON.stringify(rowOrders),
        dataType: 'json',
        type: 'POST',
        contentType: 'application/json',
        processData: false,
        success: (res) => {
        },
        error: (res) => {
        },
    });
};

// update order of tr when drag drop
const dragDropRowInTable = (() => {
    // html attribute for data order col
    const DATA_ORDER_ATTR = 'data-order';

    // get values of order columns
    const getValuesOfOrderCols = ele => $(ele).attr('id')
        || [...$(ele).find(`[${DATA_ORDER_ATTR}]`)].map(e => e.value).join('_');

    const getValuesOfOrderColsMasterConfig = ele => [...$(ele).find(`[${DATA_ORDER_ATTR}]`)].map(e => e.value).join('_')
        || $(ele).attr('id');

    // fix width of tr when drag drop
    const fixHelper = (_, ui) => {
        ui.children().each(function () {
            $(this).width($(this).width());
        });
        return ui;
    };

    // get values of order columns
    const getValuesOfOrderColsAndDsId = ele => $(ele).attr('data-ds-id')
        || [...$(ele).find(`[${DATA_ORDER_ATTR}]`)].map(e => e.value).join('_');

    const getValuesOfOrderColsAndDsProcId = ele => $(ele).attr('data-proc-id')
        || [...$(ele).find(`[${DATA_ORDER_ATTR}]`)].map(e => e.value).join('_');

    // Update LocalStorage for ordering
    const setItemLocalStorage = (tblBody, prefix = null) => {
        const tblEle = tblBody.parentNode;
        let dicRowId;
        let localStorageId = tblEle.id;
        if (prefix) {
            localStorageId = `${prefix}_${tblEle.id}`;
        }

        if (localStorageId === 'tblDbConfig') {
            dicRowId = Object.fromEntries([...tblBody.rows].map((ele, i) => [getValuesOfOrderColsAndDsId(ele), i]));
        } else {
            dicRowId = Object.fromEntries([...tblBody.rows].map((ele, i) => [getValuesOfOrderColsAndDsProcId(ele), i]));
        }

        localStorage.setItem(localStorageId, JSON.stringify(dicRowId));

        // save orders to db
        saveOrderToDB(orderName = localStorageId, rowOrders = dicRowId);
    };

    // Update LocalStorage for ordering
    const updateOrder = (event) => {
        const tblBody = event.target;
        setItemLocalStorage(tblBody);
        updateTableRowNumber(null, null, tblBody);
    };

    const sortFunction = (a, b, orderDic) => {
        const keyA = orderDic[getValuesOfOrderCols(a)];
        const keyB = orderDic[getValuesOfOrderCols(b)];
        if (keyA > keyB) return 1;
        if (keyA < keyB) return -1;
        return 0;
    };

    const sortMasterConfigRowFunction = (a, b, orderDic) => {
        const keyA = orderDic[getValuesOfOrderColsMasterConfig(a)];
        const keyB = orderDic[getValuesOfOrderColsMasterConfig(b)];
        if (keyA > keyB) return 1;
        if (keyA < keyB) return -1;
        return 0;
    };

    // sort tr in table follow localStorage data
    const sortRowInTable = (localStorageId, prefix = null) => {
        const tbody = $(`#${localStorageId}`).children('tbody');
        const rows = tbody.find('tr').get();

        if (prefix) {
            localStorageId = `${prefix}_${localStorageId}`;
        }

        const orderDic = JSON.parse(localStorage.getItem(localStorageId));

        // return if no order data
        if (!orderDic) {
            return;
        }

        if (localStorageId === 'tblVisualConfig') {
            rows.sort((a, b) => sortMasterConfigRowFunction(a, b, orderDic));
        } else {
            rows.sort((a, b) => sortFunction(a, b, orderDic));
        }
        rows.forEach(row => tbody.append(row));

        updateTableRowNumber(localStorageId); // TODO
    };

    // return public function
    return {
        DATA_ORDER_ATTR, fixHelper, updateOrder, sortRowInTable, setItemLocalStorage,
    };
})();

// eslint-disable-next-line no-unused-vars
const stickyHeaders = (() => {
    jQuery.expr.filters.offscreen = (el) => {
        const rect = el.getBoundingClientRect();
        return (
            (rect.x + rect.width) < 0
            || (rect.y + rect.height) < 0
            || (rect.x > window.innerWidth || rect.y > window.innerHeight)
        );
    };
    const $window = $(window);
    let $stickies;

    const whenScrolling = () => {
        $stickies.each((i, e) => {
            const $cardParent = $(e).parents().filter('form')
                .parent()
                .parent();
            const $thisSticky = $(e);
            const $stickyPosition = $thisSticky.data('originalPosition');

            if ($stickyPosition <= $window.scrollTop() && !$cardParent.is(':offscreen')) {
                const $nextSticky = $stickies.eq(i + 1);
                const $nextStickyPosition = $nextSticky.data('originalPosition') - $thisSticky.data('originalHeight');

                $thisSticky.addClass('btn-fixed');

                if ($nextSticky.length > 0 && $thisSticky.offset().top >= $nextStickyPosition) {
                    $thisSticky.addClass('absolute').css('top', $nextStickyPosition);
                }
            } else {
                const $prevSticky = $stickies.eq(i - 1);

                $thisSticky.removeClass('btn-fixed');

                if ($prevSticky.length > 0
                    && $window.scrollTop() <= $thisSticky.data('originalPosition') - $thisSticky.data('originalHeight')
                ) {
                    $prevSticky.removeClass('absolute').removeAttr('style');
                }
            }
        });
    };
    const load = (stickies) => {
        if (typeof stickies === 'object' && stickies instanceof jQuery && stickies.length > 0) {
            let $originWH = $(document).height();
            $stickies = stickies.each((_, e) => {
                const $thisSticky = $(e).wrap('<div class="btnWrap">');

                $thisSticky
                    .data('originalPosition', $thisSticky.offset().top)
                    .data('originalHeight', $thisSticky.outerHeight());
            });

            $window.off('scroll.stickies').on('scroll.stickies', () => {
                // re-calc position
                const $newWH = $(document).height();
                if ($newWH !== $originWH) {
                    $stickies = stickies.each((_, e) => {
                        $(e).data('originalPosition', $(e).offset().top);
                    });
                    $originWH = $newWH;
                }
                whenScrolling();
            });
        }
    };

    const divStickerOnLoad = () => {
        console.log('div sticky..');
    };
    return {
        load,
        divStickerOnLoad,
    };
})();


// TODO refactor scrollFloatingElement and stickyHeaders
// eslint-disable-next-line no-unused-vars
const scrollFloatingElement = (() => {
    jQuery.expr.filters.offscreen = (el) => {
        const rect = el.getBoundingClientRect();
        return (
            (rect.x + rect.width) < 0
            || (rect.y + rect.height) < 0
            || (rect.x > window.innerWidth || rect.y > window.innerHeight)
        );
    };
    const $window = $(window);
    let $stickies;
    let $adjustCSSClass;
    let $callBackFunc;

    const whenScrolling = () => {
        $stickies.each((i, e) => {
            const $cardParent = $(e).parents().filter('form')
                .parent()
                .parent();
            const $thisSticky = $(e);
            const $stickyPosition = $thisSticky.data('originalPosition');

            if ($stickyPosition <= $window.scrollTop() && !$cardParent.is(':offscreen')) {
                const $nextSticky = $stickies.eq(i + 1);
                const $nextStickyPosition = $nextSticky.data('originalPosition') - $thisSticky.data('originalHeight');

                // add custom css
                $thisSticky.addClass($adjustCSSClass);

                if ($nextSticky.length > 0 && $thisSticky.offset().top >= $nextStickyPosition) {
                    $thisSticky.addClass('absolute').css('top', $nextStickyPosition);
                }

                if ($callBackFunc) {
                    $callBackFunc($thisSticky);
                }
            } else {
                const $prevSticky = $stickies.eq(i - 1);

                // remove custom css
                $thisSticky.removeClass($adjustCSSClass);

                if ($prevSticky.length > 0
                    && $window.scrollTop() <= $thisSticky.data('originalPosition') - $thisSticky.data('originalHeight')
                ) {
                    $prevSticky.removeClass('absolute').removeAttr('style');
                }
            }
        });
    };
    const load = (stickies, adjustCSSClass = '', callBackFunc = null) => {
        if (typeof stickies === 'object' && stickies instanceof jQuery && stickies.length > 0) {
            let $originWH = $(document).height();
            $stickies = stickies.each((_, e) => {
                const $thisSticky = $(e).wrap('<div class="">');

                $thisSticky
                    .data('originalPosition', $thisSticky.offset().top)
                    .data('originalHeight', $thisSticky.outerHeight());
            });
            $adjustCSSClass = adjustCSSClass;
            $callBackFunc = callBackFunc;

            $window.off('scroll.stickies').on('scroll.stickies', () => {
                // re-calc position
                const $newWH = $(document).height();
                if ($newWH !== $originWH) {
                    $stickies = stickies.each((_, e) => {
                        $(e).data('originalPosition', $(e).offset().top);
                    });
                    $originWH = $newWH;
                }
                whenScrolling();
            });
        }
    };
    return {
        load,
    };
})();

const showToastrMsg = (msgContent, msgTitle, level = MESSAGE_LEVEL.WARN) => {
    if (!msgContent) {
        return;
    }

    toastr.options = {
        closeButton: true,
        debug: false,
        newestOnTop: true,
        progressBar: true,
        positionClass: 'toast-bottom-right',
        onclick: null,
        showDuration: 500,
        hideDuration: 200,
        timeOut: 10000,
        extendedTimeOut: 5000,
        showEasing: 'swing',
        hideEasing: 'linear',
        showMethod: 'fadeIn',
        hideMethod: 'fadeOut',
    };

    let $toast = null;
    if (level === MESSAGE_LEVEL.ERROR) {
        $toast = toastr.error(msgContent, msgTitle);
    } else if (level === MESSAGE_LEVEL.INFO) {
        $toast = toastr.info(msgContent, msgTitle);
    } else {
        $toast = toastr.warning(msgContent, msgTitle);
    }
    $toastlast = $toast;
};

// show toastr msg to warn about abnormal result
const showToastrAnomalGraph = () => {
    const i18nTexts = {
        warningTitle: $('#i18nWarningTitle').text(),
        abnormalGraphShow: $('#i18nAbnormalGraphShow').text().split('BREAK_LINE').join('<br>'),
    };

    const msgTitle = i18nTexts.warningTitle || '注意';
    const msgContent = `<p>${i18nTexts.abnormalGraphShow}</p>`;

    showToastrMsg(msgContent, msgTitle);
};

const showLimitSensorsToastMsg = () => {
    const i18nTexts = {
        warningTitle: $('#i18nWarningTitle').text(),
        limiationMsg: $('#i18nSensorLimitationMSP').text(),
    };

    const msgTitle = i18nTexts.warningTitle || '注意';
    const msgContent = `<p>${i18nTexts.limiationMsg}</p>`;

    showToastrMsg(msgContent, msgTitle);
};

const showToastrStartedCSV = (isCSV = true) => {
    const i18nTexts = {
        title: '',
        msgCSV: $('#i18nStartedCSVDownload').text(),
        msgTSV: $('#i18nStartedTSVDownload').text(),
    };

    const msgTitle = i18nTexts.title || '';
    const msgContent = `<p>${isCSV ? i18nTexts.msgCSV : i18nTexts.msgTSV}</p>`;

    showToastrMsg(msgContent, msgTitle, MESSAGE_LEVEL.INFO);
};

const syncTraceDateTime = (parentId = '', dtNames = {}, dtValues = {}) => {
    /*
        Synchronize datetime of query with UI date-range
    */
    if (isEmpty(parentId)) return;

    const startDate = dtNames.START_DATE;
    const startTime = dtNames.START_TIME;
    const endDate = dtNames.END_DATE;
    const endTime = dtNames.END_TIME;

    const startDateVal = dtValues.START_DATE;
    const startTimeVal = dtValues.START_TIME;
    const endDateVal = dtValues.END_DATE;
    const endTimeVal = dtValues.END_TIME;

    if (!isEmpty(startDate) && !isEmpty(startDateVal)) {
        $(`#${parentId} input[name=${startDate}]`).first().val(startDateVal);
    }
    if (!isEmpty(startTime) && !isEmpty(startTimeVal)) {
        $(`#${parentId} input[name=${startTime}]`).first().val(startTimeVal);
    }
    if (!isEmpty(endDate) && !isEmpty(endDateVal)) {
        $(`#${parentId} input[name=${endDate}]`).first().val(endDateVal);
    }
    if (!isEmpty(endTime) && !isEmpty(endTimeVal)) {
        $(`#${parentId} input[name=${endTime}]`).first().val(endTimeVal);
    }
};

const syncTraceDateTimeRange = (parentId = '', dtNames = {}, dtValues = {}) => {
    /*
        Synchronize datetime of query with UI date-range
    */
    if (isEmpty(parentId)) return;

    const datetimeRange = dtNames.DATETIME_RANGE_PICKER;
    const datetimeRangeVal = dtValues.DATETIME_RANGE_PICKER;

    if (!isEmpty(datetimeRange) && !isEmpty(datetimeRangeVal)) {
        $(`#${parentId} input[name=${datetimeRange}]`).first().val(datetimeRangeVal);
    }
};

const toUTCDateTime = (localDate, localTime) => {
    if (isEmpty(localDate) || isEmpty(localTime)) return { date: localDate, time: localTime };

    const utcDT = moment.utc(moment(`${localDate} ${localTime}`, `${DATE_FORMAT} ${TIME_FORMAT}`));
    if (utcDT.isValid()) {
        return {
            date: utcDT.format(DATE_FORMAT),
            time: utcDT.format(TIME_FORMAT),
        };
    }
    return { date: localDate, time: localTime };
};

const getColumnName = (endProcName, getVal) => {
    const col = procConfigs[endProcName].getColumnById(getVal) || {};
    return col.name || getVal;
};

const isCycleTimeCol = (endProcName, getVal) => {
    const col = procConfigs[endProcName].getColumnById(getVal) || {};
    return col.data_type === DataTypes.DATETIME.name || false;
};

// retrieve cycle time cols
const getCTCols = (endProcName) => {
    const cols = procConfigs[endProcName].getCTColumns() || {};
    return cols || null;
};

const createDatetime = (v) => {
    if (v === 'min') {
        return new Date('1970-01-01');
    }
    if (v === 'max') {
        return new Date('10000-01-01');
    }
    return new Date(v);
};


const createIndex = (v) => {
    if (v === 'min') {
        return 0;
    }
    if (v === 'max') {
        return 999999999;
    }
    return v;
};


const getChartInfo = (plotdata, xAxisOption = 'TIME') => {
    if (xAxisOption === 'INDEX') {
        const chartInfos = plotdata.chart_infos_ci || [];
        const chartInfosOrg = plotdata.chart_infos_org_ci || [];
        return [chartInfos, chartInfosOrg];
    }
    const chartInfos = plotdata.chart_infos || [];
    const chartInfosOrg = plotdata.chart_infos_org || [];
    return [chartInfos, chartInfosOrg];
};


const chooseLatestThresholds = (chartInfos = [], chartInfosOrg = [],
    clickedIdx = null, convertFunc = createDatetime) => {
    if (isEmpty(chartInfos)) return [{}, 0];


    // no click -> no point -> no time
    // if chartInfosOrg empty -> don't use chartInfosOrg
    if (isEmpty(clickedIdx)) {
        let latestChartInfo = chartInfos[0];
        let latestIndex = 0;
        for (const idx in chartInfos) {
            const chartInfo = chartInfos[idx];
            const latestActTo = latestChartInfo['act-to'];
            const actTo = chartInfo['act-to'];
            if (isEmpty(actTo) || (!isEmpty(latestActTo) && actTo > latestActTo)) {
                latestChartInfo = chartInfo;
                latestIndex = idx;
            }
        }
        return [latestChartInfo, latestIndex];
    }

    const defaultActFrom = convertFunc('min');
    const defaultActTo = convertFunc('max');
    const sensorDateTime = convertFunc(clickedIdx);

    let latestChartInfoOrg = null;
    let latestIndexOrg = null;
    for (const idx in chartInfosOrg) {
        const chartInfo = chartInfosOrg[idx];
        const actFrom = isEmpty(chartInfo['act-from']) ? defaultActFrom : convertFunc(chartInfo['act-from']);
        const actTo = isEmpty(chartInfo['act-to']) ? defaultActTo : convertFunc(chartInfo['act-to']);
        let relevantChartInfo = false;
        if (actFrom <= sensorDateTime && sensorDateTime <= actTo) {
            relevantChartInfo = true;
        }
        if (relevantChartInfo) {
            if (!latestChartInfoOrg) {
                latestChartInfoOrg = chartInfo;
                latestIndexOrg = idx;
            } else {
                const latestActTo = isEmpty(latestChartInfoOrg['act-to']) ? defaultActTo : convertFunc(latestChartInfoOrg['act-to']);
                if (latestActTo < actTo) {
                    latestChartInfoOrg = chartInfo;
                    latestIndexOrg = idx;
                }
            }
        }
    }
    const latestIndex = latestIndexOrg || 0;
    const latestChartInfo = chartInfosOrg[latestIndex] || {};
    return [latestChartInfo, latestIndex];
};

const findMinMax = (arr = []) => {
    let ymin = null;
    let ymax = null;
    if (arr && arr.length) {
        const len = arr.length;
        for (let i = 0; i < len; i++) {
            const e = arr[i];
            if (e === null || e === undefined) {
                continue;
            }
            if (ymin === null) {
                ymin = e;
                ymax = e;
            } else if (e < ymin) {
                ymin = e;
            } else if (e > ymax) {
                ymax = e;
            }
        }
    }
    return [ymin, ymax];
};

const showTooManySensorToastr = (maxNumSensor = 10) => {
    const i18nTexts = {
        warningTitle: $('#i18nWarningTitle').text(),
        msgContent: $('#i18nTooManySensors').text() || '',
    };

    const msgTitle = i18nTexts.warningTitle || '注意';
    const msgContent = `<p>${i18nTexts.msgContent.replace('MAX_NUM_SENSOR', maxNumSensor)}</p>`;

    showToastrMsg(msgContent, msgTitle);
};

const formatResultMulti = (data) => {
    let classAttr = $(data.element).attr('class');
    const hasClass = typeof classAttr !== 'undefined';
    classAttr = hasClass ? ` ${classAttr}` : '';

    let columnName = $(data.element).attr('title');
    if (columnName === undefined) {
        columnName = '---';
    }

    const $result = $(
        `${'<div class="row">'
        + '<div class="col-md-6 col-xs-6'}${classAttr}">${columnName}</div>`
        + `<div class="col-md-6 col-xs-6${classAttr}">${data.text}</div>`
        + '</div>',
    );
    return $result;
};

const matchCustom = (params, data) => {
    if (typeof params.term === 'undefined') {
        return data;
    }

    // If there are no search terms, return all of the data
    if ($.trim(params.term) === '') {
        return data;
    }

    // Do not display the item if there is no 'text' property
    if (typeof data.text === 'undefined') {
        return null;
    }

    // `params.term` should be the term that is used for searching
    // `data.text` is the text that is displayed for the data object
    params.term = stringNormalization(params.term);
    params.term = params.term.toLowerCase();
    const dataText = data.text.toLowerCase();
    const dataTitle = data.title.toLowerCase();
    if (dataText.indexOf(params.term) > -1 || dataTitle.indexOf(params.term) > -1) {
        const modifiedData = $.extend({}, data, true);

        // You can return modified objects from here
        // This includes matching the `children` how you want in nested data sets
        return modifiedData;
    }

    // Return `null` if the term should not be displayed
    return null;
};

const setSelect2Selection = (parent = null) => {
    let eles;
    if (parent) {
        eles = $(parent);
    } else {
        eles = $(document);
    }

    const nColCls = 'select-n-columns';
    // const alreadyConvertCls = 'already-convert-select2';
    const dicOptions = {
        placeholder: `${i18nCommon.search}...`,
        allowClear: true,
        width: '100%',
        matcher: matchCustom,
    };

    const dicNColsOptions = {
        placeholder: `${i18nCommon.search}...`,
        allowClear: true,
        width: '100%',
        templateResult: formatResultMulti,
        matcher: matchCustom,
    };

    // single select2
    eles.find('select.select2-selection--single').each(function () {
        const ele = $(this);
        // if (ele.hasClass(alreadyConvertCls)) {
        //     return;
        // }

        if (ele.hasClass(nColCls)) {
            ele.select2(dicNColsOptions);
        } else {
            ele.select2(dicOptions);
        }

        // dropdown fix data TODO: consider better way
        // ele.select2({ dropdownAutoWidth: true });

        // TODO: if add this class , select2 can not select anymore , but we need this code to improve performance.
        // ele.addClass(alreadyConvertCls);
    });
};

const uniq = vals => [...new Set(vals)];


const getPearsonCorrelation = (_x, _y) => {
    let shortestArrayLength = 0;
    const x = _x.filter(i => Number.isFinite(i));
    const y = _y.filter(i => Number.isFinite(i));
    if (x.length === y.length) {
        shortestArrayLength = x.length;
    } else if (x.length > y.length) {
        shortestArrayLength = y.length;
        // console.error(`x has more items in it, the last ${x.length - shortestArrayLength} item(s) will be ignored`);
    } else {
        shortestArrayLength = x.length;
        // console.error(`y has more items in it, the last ${y.length - shortestArrayLength} item(s) will be ignored`);
    }

    const xy = [];
    const x2 = [];
    const y2 = [];

    for (let i = 0; i < shortestArrayLength; i++) {
        if (!isEmpty(x[i]) && !isEmpty(y[i])) {
            xy.push(x[i] * y[i]);
            x2.push(x[i] * x[i]);
            y2.push(y[i] * y[i]);
        }
    }

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    let sumY2 = 0;

    for (let i = 0; i < shortestArrayLength; i++) {
        if (!isEmpty(x[i]) && !isEmpty(y[i])) {
            sumX += x[i];
            sumY += y[i];
            sumXY += xy[i];
            sumX2 += x2[i];
            sumY2 += y2[i];
        }
    }

    const step1 = (shortestArrayLength * sumXY) - (sumX * sumY);
    const step2 = (shortestArrayLength * sumX2) - (sumX * sumX);
    const step3 = (shortestArrayLength * sumY2) - (sumY * sumY);
    const step4 = Math.sqrt(step2 * step3);
    const answer = step1 / step4;

    if (Number.isNaN(answer) || !Number.isFinite(answer)) {
        return 'N/A';
    }
    return answer.toFixed(3);
};

const genPlotlyIconSettings = () => ({
    modeBarButtonsToRemove: [
        'zoom2d', 'pan2d', 'select2d', 'lasso2d', 'zoomIn2d', 'zoomOut2d',
        'hoverClosestCartesian', 'hoverCompareCartesian',
        'toggleSpikelines', 'sendDataToCloud',
    ],
    displaylogo: false,
});

const initializeDateTime = (dtElements = {}, syncStartEnd = true) => {
    let dateDiff = 0;
    const startDateElement = dtElements.START_DATE || $('input[name="START_DATE"]');
    const endDateElement = dtElements.END_DATE || $('input[name="END_DATE"]');
    const startTimeElement = dtElements.START_TIME || $('input[name="START_TIME"]');
    const endTimeElement = dtElements.END_TIME || $('input[name="END_TIME"]');

    // set default time
    if (formElements.radioDefaultInterval) {
        formElements.radioDefaultInterval.prop('checked', true);
    }

    // set date format
    $('.datepicker').datepicker({
        dateFormat: DATE_PICKER_FORMAT,
    });

    const timeSetting = {
        regional: 'ja',
        controlType: 'select',
        oneLine: true,
        timeFormat: 'HH:mm',
    };
    startDateElement.datepicker('setDate', '0');
    startTimeElement.timepicker(timeSetting).val('07:00');
    // use old value for validation
    startDateElement.attr('data-current-val', startDateElement.val());
    startTimeElement.attr('data-current-val', startTimeElement.val());

    // set end_date value to start_date value when changing start_date
    startDateElement.on('change', (event) => {
        validateDateTime(event, DATE_FORMAT_VALIDATE);
        if (syncStartEnd) {
            // update end_date to value of start_date
            const startDate = startDateElement.val();
            const mStartDate = moment(startDate, DATE_FORMAT);
            const newEndDate = mStartDate.add(dateDiff, 'days').format(DATE_FORMAT);
            endDateElement.val(newEndDate);
            endDateElement.attr('data-current-val', newEndDate);
            // todo: update datetime range span
        }
    });
    if (endDateElement && endDateElement.length === 1) {
        endDateElement.datepicker('setDate', '0');
        endTimeElement.timepicker(timeSetting).val('19:00');
        endDateElement.attr('data-current-val', endDateElement.val());
        endTimeElement.attr('data-current-val', endTimeElement.val());

        // validate end_date
        endDateElement.on('change', (event) => {
            validateDateTime(event, DATE_FORMAT_VALIDATE);
            if (syncStartEnd) {
                // update date diffence between start date and end date
                const startDate = startDateElement.val();
                const mStartDate = moment(startDate, DATE_FORMAT);
                const mEndDate = moment(endDateElement.val(), DATE_FORMAT);
                dateDiff = mEndDate.diff(mStartDate, 'days');
            }
        });
        // validate end_time
        endTimeElement.on('change', (event) => {
            validateDateTime(event, TIME_FORMAT_VALIDATE);
        });
    }

    // validate start_time
    startTimeElement.on('change', (event) => {
        validateDateTime(event, TIME_FORMAT_VALIDATE);
    });


    // allow number > 0 only for latest time interval
    validateRecentTimeInterval($('input[name="recentTimeInterval"]'));
};

const validateDateTime = (event, dtFormat) => {
    const curTarget = event.target;
    const newValue = event.target.value;
    if (newValue === curTarget.getAttribute('data-current-val')) {
        return;
    }
    const { currentVal } = event.target.dataset;
    if (!moment(newValue, dtFormat, true).isValid()) {
        event.target.value = currentVal;
    } else {
        event.target.dataset.currentVal = newValue;
    }
};

const adjustMinMax1Percent = (minY, maxY) => [minY - 0.01 * Math.abs(minY), maxY + 0.01 * Math.abs(maxY)];

const createHistogramParams = (scaleOption, arrayY,
    setYMin, setYMax,
    commonMinY, commonMaxY, latestChartInfo, corrSummary) => {
    //  max/minY based on scaleOption
    let maxY = getNode(corrSummary, ['non_parametric', 'upper_range']);
    let minY = getNode(corrSummary, ['non_parametric', 'lower_range']);
    if (scaleOption === '1') {
        const cfgYMax = latestChartInfo['y-max'];
        const cfgYMin = latestChartInfo['y-min'];
        if (cfgYMax) minY = cfgYMax;
        if (cfgYMin) maxY = cfgYMin;
    } else if (scaleOption === '2') {
        minY = commonMinY;
        maxY = commonMaxY;
    } else if (scaleOption === '3') {
        const threshHigh = latestChartInfo['thresh-high'];
        const threshLow = latestChartInfo['thresh-low'];
        if (!isEmpty(threshHigh) && !isEmpty(threshLow) && threshHigh !== threshLow) {
            maxY = threshHigh + Math.abs(threshHigh - threshLow) * 0.125;
            minY = threshLow - Math.abs(threshHigh - threshLow) * 0.125;
        }
    } else if (scaleOption === '5') {
        minY = setYMin;
        maxY = setYMax;
    }

    if (minY === maxY) {
        [minY, maxY] = adjustMinMax1Percent(minY, maxY);
    }
    if (minY > maxY) { // rare case, i saw long time ago
        const temp = minY;
        minY = maxY;
        maxY = temp;
    }

    const globalRange = [minY, maxY];
    const customBinSize = Math.max((globalRange[1] - globalRange[0]) / 128, Math.round(setYMax - setYMin) / 128) || 1;

    return [minY, maxY, globalRange, customBinSize];
};

const colorErrorCells = (jexcelDivId, errorCells) => {
    if (isEmpty(errorCells)) return;

    const styleParams = errorCells.reduce((a, b) => ({ ...a, [b]: 'color:red;' }), {});
    document.getElementById(jexcelDivId).jspreadsheet.setStyle(styleParams);
};

const colorErrorCheckboxCells = (jexcelDivId, errorCells) => {
    if (isEmpty(errorCells)) return;

    const styleParams = errorCells.reduce((a, b) => ({ ...a, [b]: 'background-color: red;' }), {});
    document.getElementById(jexcelDivId).jspreadsheet.setStyle(styleParams);
};

const showGAToastr = (errors) => {
    if (!errors) {
        return;
    }

    const msgTitle = i18n.warning;
    const msgContent = `<p>${i18n.gaUnable}</p>
    <p>${i18n.gaCheckConnect}</p>`;
    showToastrMsg(msgContent, msgTitle);
};

const getSelectedItems = (isCategoryItem = false) => {
    const selectedItems = [];

    let allSelected = [];
    if (isCategoryItem) {
        allSelected = $(formElements.endProcCateSelectedItem);
    } else {
        allSelected = $(formElements.endProcSelectedItem);
    }

    if (allSelected.length > 0) {
        Array.prototype.forEach.call(allSelected, (selected) => {
            if ($(selected).attr('name') !== 'catExpBox') {
                if (selected.value && selectedItems.includes(selected.value) === false) {
                    selectedItems.push(selected.value);
                }
            }
        });
    }
    return selectedItems;
};

// PythonのNumpyのhistgram関数相当のヒストグラム計算処理を実施
function genHistLabelsCounts(arrayVals, localNumBins, localValMin, localValMax) {
    const labelMin = !isEmpty(localValMin) ? localValMin : Math.min.apply(null, arrayVals);
    const labelMax = !isEmpty(localValMax) ? localValMax : Math.max.apply(null, arrayVals);

    const histLabels = genHistLabels(labelMin, labelMax, localNumBins);
    const histCounts = genHistCounts(histLabels, arrayVals, labelMin, labelMax);

    // histLablesの配列の最後の要素はhistCountsより1つ多く余分のため削除
    histLabels.pop();
    // histLabelsがヒストグラムのX軸、histCountsがヒストグラムのY軸
    // 表示を合わせるために値を逆順にする
    return { histLabels: histLabels.reverse(), histCounts: histCounts.reverse() };
}

function genHistLabels(labelMin, labelMax, localNumBins) {
    const histLabels = [];
    const interval = (labelMax - labelMin) / localNumBins;
    let val = labelMin;
    histLabels.push(val);
    for (let i = 0; i < localNumBins; i++) {
        val += interval;
        histLabels.push(Number(val).toPrecision(4));
    }
    return histLabels;
}

function genHistCounts(histLabels, arrayVals, labelMin, labelMax) {
    // まずはhistLabels - 1個分の値0の配列を生成
    const histCounts = [];
    for (let i = 0; i < histLabels.length - 1; i++) {
        histCounts.push(0);
    }
    let numLabelMin = 0;
    let numLabelMax = 0;

    for (let i = 0; i < arrayVals.length; i++) {
        const val = arrayVals[i];
        // 境界条件の不具合を避けるため最小値、最大値は一旦スキップ
        if (val === labelMin) {
            numLabelMin += 1;
            continue;
        }
        if (val === labelMax) {
            numLabelMax += 1;
            continue;
        }
        for (let j = 0; j < histLabels.length; j++) {
            if (j === histLabels.length - 1) {
                break;
            }
            const histLabelMin = histLabels[j];
            const histLabelMax = histLabels[j + 1];
            if (val !== null && val !== undefined && val >= histLabelMin && val < histLabelMax) {
                histCounts[j] += 1;
            }
        }
    }
    // 最小値分を一番左の要素に追加
    histCounts[0] += numLabelMin;
    // 最大値分を一番右の要素に追加
    histCounts[histLabels.length - 2] += numLabelMax;
    return histCounts;
}

const endProcMultiSelectOnChange = async (count, radio = false, showDataType = null,
    showStrColumn = null, showCatExp = null, isRequired = false,
    showLabels = false, showObjective = false, showColor = false) => {
    // const selectedProc = $(`#end-proc-process-${count}`).val();
    // const selectedProc = $(`#end-proc-process-${count}`)[0].value;
    const selectedProc = $(`#end-proc-process-${count}`);
    if (selectedProc.length === 0) {
        return;
    }
    const procId = selectedProc[0].value;
    const procInfo = procConfigs[procId];

    // remove old elements
    $(`#end-proc-val-${count}`).remove();
    if (procInfo == null) {
        updateSelectedItems();
        return;
    }
    const ids = [];
    const vals = [];
    const names = [];
    const checkedIds = [];
    const dataTypes = [];
    await procInfo.updateColumns();
    const procColumns = procInfo.getColumns();

    // const dataTypeTargets = showStrColumn ? CfgProcess.NUMERIC_AND_STR_TYPES : CfgProcess.NUMERIC_TYPES;
    const dataTypeTargets = showStrColumn ? CfgProcess.ALL_TYPES : CfgProcess.NUMERIC_TYPES;

    // for (const datType of dataTypeTargets) {
    //     for (const col of procColumns) {
    //         if (col.data_type === datType) {
    //             ids.push(col.id);
    //             vals.push(col.column_name);
    //             names.push(col.name);
    //             // checkedIds.push(col.id);
    //             dataTypes.push(col.data_type);
    //         }
    //     }
    // }

    // push cycle time columns first
    if (showStrColumn) {
        const [ctCol] = procInfo.getCTColumn();
        const datetimeCols = procInfo.getDatetimeColumns();
        if (ctCol) {
            ids.push(ctCol.id);
            vals.push(ctCol.column_name);
            names.push(ctCol.name);
            dataTypes.push(ctCol.data_type);
        }
        if (datetimeCols) {
            for (const dtCol of datetimeCols) {
                ids.push(dtCol.id);
                vals.push(dtCol.column_name);
                names.push(dtCol.name);
                dataTypes.push(dtCol.data_type);
            }
        }
    }

    let getDateColID = null;
    for (const col of procColumns) {
        if (col.is_get_date) {
            getDateColID = col.id;
        }
        if (dataTypeTargets.includes(col.data_type) && !CfgProcess.CT_TYPES.includes(col.data_type)) {
            ids.push(col.id);
            vals.push(col.column_name);
            names.push(col.name);
            // checkedIds.push(col.id);
            dataTypes.push(col.data_type);
        }
    }

    // load machine multi checkbox to Condition Proc.
    if (ids) {
        const parentId = `end-proc-val-div-${count}`;
        if (radio) {
            addGroupListCheckboxWithSearch(parentId, `end-proc-val-${count}`, '',
                ids, vals, checkedIds, `GET02_VALS_SELECT${count}`, false, names,
                null, showDataType ? dataTypes : null, true, showCatExp,
                isRequired, getDateColID, showObjective, null, showLabels, [], count, showColor);
        } else {
            addGroupListCheckboxWithSearch(parentId, `end-proc-val-${count}`, '',
                ids, vals, checkedIds, `GET02_VALS_SELECT${count}`, false, names, null,
                showDataType ? dataTypes : null, false, showCatExp,
                isRequired, getDateColID, showObjective, null, showLabels, [], count, showColor);
        }
    }
    updateSelectedItems();
    onchangeRequiredInput();
};

// add end proc
const addEndProcMultiSelect = (procIds, procVals, showItemDataType = false, showStrColumn = false,
    showCatExp = false, isRequired = false, showLabels = false, showObjective = false, showColor = false) => {
    let count = 1;
    const innerFunc = (onChangeCallbackFunc = null, onCloseCallbackFunc = null, onChangeCallbackDicParam = null, onCloseCallbackDicParam = null) => {
        const itemList = [];
        for (let i = 0; i < procIds.length; i++) {
            const itemId = procIds[i];
            const itemVal = procVals[i];
            itemList.push(`<option value="${itemId}">${itemVal}</option>`);
        }

        while (checkExistDataGenBtn('btn-add-end-proc', count)) {
            count = countUp(count);
        }

        const parentID = `end-proc-process-div-${count}-parent`;

        const proc = `<div class="col-12 col-lg-6 col-sm-12 p-1">
                <div class="card end-proc table-bordered py-sm-3" id="${parentID}">
                        <span class="pull-right clickable close-icon" data-effect="fadeOut">
                            <i class="fa fa-times"></i>
                        </span>
                        <div class="d-flex align-items-center" id="end-proc-process-div-${count}">
                            <span class="mr-2">${i18nCommon.process}</span>
                            <div class="w-auto flex-grow-1">
                                <select class="form-control select2-selection--single ${isRequired ? 'required-input' : ''}" name="end_proc${count}"
                                id="end-proc-process-${count}" data-gen-btn="btn-add-end-proc">
                                    ${itemList.join(' ')}
                                </select>
                            </div>
                        </div>
                        <div id="end-proc-val-div-${count}">
                        </div>
                     </div>
                    </div>`;

        $('#end-proc-row div').last().before(proc);
        $(`#end-proc-process-${count}`).on('change', (e) => {
            const eleNumber = e.currentTarget.id.match(/\d+$/)[0];
            endProcMultiSelectOnChange(eleNumber, false, showItemDataType,
                showStrColumn, showCatExp, isRequired, showLabels, showObjective, showColor).then((r) => {
                if (onChangeCallbackFunc) {
                    if (onChangeCallbackDicParam) {
                        onChangeCallbackFunc(onChangeCallbackDicParam);
                    } else {
                        onChangeCallbackFunc(e);
                    }
                }
            });
        });

        resizeListOptionSelect2(parentID);
        cardRemovalByClick('#end-proc-row div', onCloseCallbackFunc, onCloseCallbackDicParam);
    };
    return innerFunc;
};


const getStratifiedVars = async (selectedEndProc) => {
    if (!selectedEndProc) {
        return;
    }
    const svcolumns = $(eles.sVColumns);
    svcolumns.html('');

    const procInfo = procConfigs[selectedEndProc];
    await procInfo.updateColumns();
    const stratifiedVarColumns = procInfo.getCategoryColumns();

    let maxLen = 0;
    for (const col of stratifiedVarColumns) {
        if (col.name && col.name.length > maxLen) {
            maxLen = col.name.length;
        }
    }

    let stratifiedVarOptions = '<option value="">---</option>';
    stratifiedVarColumns.forEach((col) => {
        stratifiedVarOptions += `<option value="${col.id}" title="${col.column_name}">${col.name}</option>`;
    });
    svcolumns.html(stratifiedVarOptions);
};

const afterRequestAction = () => {
    loadingHide();
    scrollList2Top();
};

const scrollList2Top = () => {
    $('.list-group').scrollTop(0);
    $('ul').scrollTop(0);
};

const updateTableRowNumber = (tableId = null, tableElement = null, tableBody = null) => {
    // numbering rows in a table
    try {
        if (!isEmpty(tableElement)) {
            tableElement.find('tbody tr').each((rowIdx, row) => {
                $(row).find('td.col-number').text(rowIdx + 1);
            });
            return;
        }
        if (!isEmpty(tableId)) {
            $(`#${tableId} tbody tr`).each((rowIdx, row) => {
                $(row).find('td.col-number').text(rowIdx + 1);
            });
            return;
        }

        if (!isEmpty(tableBody)) {
            $(tableBody).find('tr').each((rowIdx, row) => {
                $(row).find('td.col-number').text(rowIdx + 1);
            });
        }
    } catch (e) {
        //
    }
};

const collapseFloatingList = (el) => {
    // collapse <ul> list
    $(el).removeClass('floating-dropdown');
    $(el).removeClass('disable-max-height');
    $(el).css({ width: '', height: '', transform: '' });
    $(el).parent().css({ height: '' });

    // const shouldReOrder = (el) => {
    //     const options = $(el).find('li input[type=checkbox], li input[type=radio]');
    //     for (let i = 0; i < options.length; i++) {
    //         if (i > 0) {
    //             const isChecked = options[i].checked;
    //             const isPreviousChecked = options[i - 1].checked;
    //             const previousVal = options[i - 1].value;
    //             const selectedButNotTop = i > 1 && isChecked && !isPreviousChecked && previousVal !== 'All';
    //             if (selectedButNotTop) {
    //                 return true;
    //             }
    //         }
    //     }
    //
    //     return false;
    // };

    // check before re-order
    // if (!shouldReOrder(el)) {
    //     return;
    // }

    // move selected options to top
    const isChanged = sortHtmlElements($(el));
    if (isChanged) {
        $(el).scrollTop(0);
    }
};
const collapseFloatingLists = () => {
    $('.floating-dropdown').each((i, el) => {
        collapseFloatingList(el);
    });
};

let savedBox = null;
const keyPress = (e) => {
    if (e.key === 'Escape') {
        collapseFloatingLists();
    } else if (e.key === 'ArrowLeft') {
        if (savedBox) { // TODO use common function, doesn't work now
            $('.cate-tooltip').css({ visibility: 'hidden' }); // hide all tooltip
            let count = 0;
            let previousBox = savedBox.previousSibling;
            while (previousBox && count < 2000) { // TODO limit to a max iteration
                if ($(previousBox).hasClass('keyboard-movement')) {
                    // reset previous box
                    $('#cateTable table td.box-has-data.cate-box-border').removeClass('cate-box-border');
                    $(savedBox).removeClass('cate-box-border');

                    // update current box
                    savedBox = previousBox;
                    $(savedBox).addClass('cate-box-border');
                    $(savedBox).find('span.cate-value .cate-tooltip').css({ visibility: 'visible' });
                    break;
                } else {
                    previousBox = previousBox.previousSibling;
                }
                count += 1;
            }
        }
    } else if (e.key === 'ArrowRight') {
        if (savedBox) {
            $('.cate-tooltip').css({ visibility: 'hidden' });
            let count = 0;
            let nextBox = savedBox.nextSibling;
            while (nextBox && count < 2000) {
                if ($(nextBox).hasClass('keyboard-movement')) {
                    $('#cateTable table td.box-has-data.cate-box-border').removeClass('cate-box-border');
                    $(savedBox).removeClass('cate-box-border');

                    savedBox = nextBox;
                    $(savedBox).addClass('cate-box-border');
                    $(savedBox).find('span.cate-value .cate-tooltip').css({ visibility: 'visible' });
                    break;
                } else {
                    nextBox = nextBox.nextSibling;
                }
                count += 1;
            }
        }
    }
};

const loadingShow = (isContinue = false) => {
    const resetProgress = () => {
        // console.log('resetProgress');
        loadingProgressBackend = 0;
    };

    // init
    setTimeout(() => {
        $.LoadingOverlay('show', {
            image: '',
            progress: true,
            progressFixedPosition: 'top',

            progressColor: 'rgba(170, 170, 170, 1)',
            size: 9,
            background: 'rgba(170, 170, 170, .25)',
            fontawesomeColor: 'rgba(170, 170, 170, 1)',
            fontawesome: 'fa fa-spinner fa-spin',
            fontawesomeResizeFactor: 2,
        });
    }, 0);

    if (!isContinue) {
        resetProgress();
    }
};

const loadingUpdate = (pct) => {
    setTimeout(() => {
        // console.log('loadingUpdate', parseInt(pct));
        $.LoadingOverlay('progress', parseInt(pct));
    }, 0);
};

const loadingHide = () => {
    setTimeout(() => {
        // console.log('loadingHide');
        $.LoadingOverlay('progress', 100);
        $.LoadingOverlay('hide');
    }, 0);
};

const loadingHideDelayTime = noRecords =>
    // console.log('loadingHideDelayTime', Math.min((noRecords || 1000), 1000)/3);
    Math.min((noRecords || 1000), 1000) / 3;


const errorHandling = (error) => {
    if (error.statusText.toLowerCase().includes('timeout')) {
        console.log('request timeout..');
        const i18nTexts = {
            warningTitle: 'Request timeout',
            abnormalGraphShow: $('#i18nRequestTimeout').text(),
        };

        const msgTitle = i18nTexts.warningTitle || '注意';
        const msgContent = `<p>${i18nTexts.abnormalGraphShow}</p>`;

        showToastrMsg(msgContent, msgTitle, MESSAGE_LEVEL.ERROR);
    } else {
        showToastrAnomalGraph();
    }
};


class GraphStore {
    constructor() {
        this.dctCanvas2TimeSeries = {};
        this.dctCanvas2Whisker = {};
        this.dctCanvas2Histogram = {};
        this.dctCanvas2Scatter = {};

        // map: histogram -> timeseries of the same row
        this.dctHistId2TimesSeries = {};

        // trace data output
        this.traceDataResult = {};
        this.dataPointCount = 0;

        // store clicked data points of time series chart
        this.clickedPointIndexes = new Set();

        // canvasId -> hovered index + datasetIndex; use canvasId to get chart object later on
        // 1 chart can have many datasets -> save datasetIndex
        this.lastHoveredDataPoint = {};

        this.selectedCanvas = null;
    }

    setSelectedCanvas(canvasId) {
        this.selectedCanvas = canvasId;
    }

    getSelectedCanvas() {
        return this.selectedCanvas;
    }

    saveHoveredDataPoint(canvasId, hoveredIndex) {
        this.lastHoveredDataPoint[canvasId] = hoveredIndex;
    }

    getLastHoveredDataPoint(canvasId) {
        return this.lastHoveredDataPoint[canvasId];
    }

    setClickedPointIndexes(indexes) {
        this.clickedPointIndexes = indexes;
    }

    getClickedPointIndexes() {
        return this.clickedPointIndexes;
    }

    addClickedPointIndexes(index) {
        this.clickedPointIndexes.add(index);
    }

    getAllTimeSeries() {
        return Object.values(this.dctCanvas2TimeSeries) || [];
    }

    getAllTimeSeriesCanvasIds() {
        return Object.keys(this.dctCanvas2TimeSeries) || [];
    }

    getAllHistogram() {
        return Object.values(this.dctCanvas2Histogram) || [];
    }

    getAllScatterPlot() {
        return Object.values(this.dctCanvas2Scatter) || [];
    }

    setDctCanvas2Scatter(dictCanvas2Scatter) {
        this.dctCanvas2Scatter = dictCanvas2Scatter;
    }

    addTimeSeriesObj(canvasId, graphObj) {
        this.dctCanvas2TimeSeries[canvasId] = graphObj;
    }

    addWhiskerObj(canvasId, graphObj) {
        this.dctCanvas2Whisker[canvasId] = graphObj;
    }

    addHistogramObj(canvasId, graphObj) {
        this.dctCanvas2Histogram[canvasId] = graphObj;
    }

    addScatterObj(canvasId, graphObj) {
        this.dctCanvas2Scatter[canvasId] = graphObj;
    }

    addHist2TimeSeries(canvasId, tsGraphObj) {
        this.dctHistId2TimesSeries[canvasId] = tsGraphObj;
    }

    getTimeSeriesById(canvasId) {
        return this.dctCanvas2TimeSeries[canvasId];
    }

    getWhiskerById(canvasId) {
        return this.dctCanvas2Whisker[canvasId];
    }

    getHistById(canvasId) {
        return this.dctCanvas2Histogram[canvasId];
    }

    getScatterById(canvasId) {
        return this.dctCanvas2Scatter[canvasId];
    }

    getTimeSeriesFromHist(canvasId) {
        return this.dctHistId2TimesSeries[canvasId];
    }

    destroyAllGraphInstances() {
        this.dctCanvas2TimeSeries = {};
        this.dctCanvas2Histogram = {};
        this.dctCanvas2Scatter = {};
        this.dctHistId2TimesSeries = {};

        // destroy all old chart instances before showing new graphs
        for (const graphIdx in Chart.instances) {
            try {
                Chart.instances[graphIdx].destroy();
            } catch (error) {
                console.log(error);
            }
        }
    }

    setTraceData(data) {
        this.traceDataResult = data;
        this.countDataPoint();
    }

    getTraceData() {
        return this.traceDataResult;
    }

    getDataAtIndex(dataIdx, dataPointIdx) {
        const plotDatas = getNode(this.traceDataResult, ['array_plotdata']) || [];
        const empty = { x: '', y: '' };
        if (isEmpty(plotDatas) || plotDatas.length <= dataIdx) {
            return empty;
        }
        const plotData = plotDatas[dataIdx];
        if (isEmpty(plotData) || plotData.length <= dataPointIdx) {
            return empty;
        }
        return {
            x: plotData.array_x[dataPointIdx],
            y: plotData.array_y[dataPointIdx],
        };
    }

    getArrayPlotData(canvasId) {
        const dataIdx = $(`#${canvasId}`).attr('plotdata-index') || 0;
        const plotDatas = getNode(this.traceDataResult, ['array_plotdata']) || [];
        if (isEmpty(plotDatas) || plotDatas.length <= dataIdx) {
            return empty;
        }
        return plotDatas[dataIdx];
    }

    countDataPoint() {
        if (isEmpty(this.traceDataResult)) {
            this.dataPointCount = 0;
        } else {
            const timeColLenght = ('times' in this.traceDataResult) ? this.traceDataResult.times.length : 0;
            if (timeColLenght) {
                const numSensors = this.traceDataResult.array_plotdata.length;
                this.dataPointCount = (timeColLenght + 128) * numSensors * 2;
            }
        }
    }

    getCountDataPoint() {
        console.log('this.dataPointCount: ', this.dataPointCount);
        return this.dataPointCount || 0;
    }

    getPCPArrayPlotDataByID(colID) {
        const plotDatas = getNode(this.traceDataResult, ['array_plotdata']) || [];
        if (isEmpty(plotDatas)) {
            return {};
        }
        const plotObj = {};
        plotDatas.forEach((plot, k) => {
            if (plot.col_detail && plot.col_detail.id === colID) {
                plotObj.key = k;
                plotObj.data = plot;
            }
        });
        return plotObj;
    }
}

const applySignificantDigit = (val, sigDigit = 4) => {
    try {
        const signifyVal = Number(val).toPrecision(sigDigit);
        if (signifyVal.includes('.')) {
            return signifyVal.replace(/(\.0+|0+)$/, '');
        }
        if (signifyVal === 'NaN') {
            return val;
        }
        return signifyVal;
    } catch (e) {
        return val;
    }
};

const makeDictFrom2Arrays = (keys, vals) => {
    const result = {};
    keys.forEach((key, i) => result[key] = vals[i]);

    return result;
};

// draw processing time
const drawProcessingTime = (t0, t1, backendTime, rowNumber) => {
    const frontendTime = t1 - t0;
    const totalTime = (frontendTime / 1000) + backendTime; // seconds
    const processTime = `Processing time: ${totalTime.toFixed(2)} sec, Number of queried data : ${formatNumberWithCommas(rowNumber)}`;
    const lastUpdateTime = `Last update time: ${moment().format(DATETIME_FORMAT)}`;
    $('#lastUpdateTime').html(lastUpdateTime);
    $('#processingTime').html(processTime);
};

const getScaleInfo = (plotdata, scaleOption) => {
    switch (scaleOption) {
    case scaleOptionConst.SETTING:
        return plotdata.scale_setting;
    case scaleOptionConst.COMMON:
        return plotdata.scale_common;
    case scaleOptionConst.THRESHOLD:
        return plotdata.scale_threshold;
    case scaleOptionConst.AUTO:
        return plotdata.scale_auto;
    case scaleOptionConst.FULL_RANGE:
        return plotdata.scale_full;
    }

    return null;
};

const chartAreaBorder = {
    id: 'chartAreaBorder',
    beforeDraw(chart, args, options) {
        const {
            ctx, chartArea: {
                left, top, width, height,
            },
        } = chart;
        ctx.save();
        ctx.strokeStyle = options.borderColor;
        ctx.lineWidth = options.borderWidth;
        ctx.setLineDash(options.borderDash || []);
        ctx.lineDashOffset = options.borderDashOffset;
        ctx.strokeRect(left, top, width, height);
        ctx.restore();
    },
};

const scatterInsideTitle = {
    id: 'scatterInsideTitle',
    beforeDatasetsDraw(chart, args, options) {
        const {
            ctx, chartArea: {
                left, top, width, height,
            },
        } = chart;
        ctx.save();
        ctx.font = `${options.font.size}px ${options.font.family}`;

        if (options.xContent.length) {
            ctx.fillStyle = options.color[0];
            const xTextWidth = ctx.measureText(options.xContent[0]).width;
            ctx.fillText(options.xContent, left + (width / 2 - xTextWidth / 2), height - top + 10);
        }
        if (options.yContent.length) {
            ctx.fillStyle = options.color[1];
            const yTextWidth = ctx.measureText(options.yContent[0]).width;
            ctx.translate(70, top + (height / 2 + yTextWidth / 2));
            ctx.rotate(-0.5 * Math.PI);
            ctx.fillText(options.yContent, 0, 10);
        }

        ctx.restore();
    },
};

// transform facet params
const transformFacetParams = (formData, eleIdPrefix = '') => {
    const allFacets = formData.getAll('catExpBox');

    // find level1
    if (allFacets.includes(facetLevels.LV_1)) {
        getSetFacetValue(facetLevels.LV_1, 'catExpBox1', formData, eleIdPrefix);
    }
    // find level2
    if (allFacets.includes(facetLevels.LV_2)) {
        getSetFacetValue(facetLevels.LV_2, 'catExpBox2', formData, eleIdPrefix);
    }

    if (allFacets.includes(facetLevels.DIV)) {
        getSetFacetValue(facetLevels.DIV, 'div', formData, eleIdPrefix);
    }
    formData.delete('catExpBox');
    return formData;
};

const getSetFacetValue = (value, name, formData, eleIdPrefix) => {
    const endProcDiv = eleIdPrefix ? `${eleIdPrefix}-end-proc-row` : 'end-proc-row';
    const facetItem = $(`#${endProcDiv} select[name="catExpBox"] option:selected[value="${value}"]`).parent().attr('id');
    if (facetItem) {
        const facetItemObj2 = facetItem.split('-');
        const facetItemID = facetItemObj2[facetItemObj2.length - 1];
        formData.set(name, facetItemID);
    }
};

const collectFormData = (formID) => {
    const form = $(formID);
    let formData = new FormData(form[0]);
    formData = chooseTraceTimeInterval(formData);
    for (const item of formData.entries()) {
        const key = item[0];
        const value = item[1];
        if (/cond_proc/.test(key) && isEmpty(value)) {
            formData.delete(key);
        }
    }

    return formData;
};

const bindCategoryParams = (formData) => {
    for (const item of formData.entries()) {
        const key = item[0];
        const value = item[1];
        let endProcId = null;
        if (key.includes('GET02_CATE_SELECT') && !isEmpty(value)) {
            const [, procGroupIdx] = key.split('GET02_CATE_SELECT');
            if (procGroupIdx) {
                endProcId = formData.get(`end_proc${procGroupIdx}`);
            }
            if (endProcId) {
                formData.set(`end_proc_cate${procGroupIdx}`, endProcId);
            }
        }
    }
    return formData;
};

const formatNumberWithCommas = n => (n ? n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') : n);

const hideTooltip = (selector, timeOut = 1000) => {
    setTimeout(() => {
        $(selector).tooltip('hide')
            .attr('data-original-title', '');
    }, timeOut);
};

const setTooltip = (selector, message, autoHide = true) => {
    const title = $(selector).attr('title');
    $(selector).attr('data-original-title', message)
        .attr('title', '')
        .tooltip('show');

    if (autoHide) {
        hideTooltip(selector);
        if (title) {
            $(selector).attr('title', title);
        }
    }
};

// transform KDE value to max value of histogram
const getTransKDE = (kdeData) => {
    const kdes = [...kdeData.kde].reverse();
    const labelReversed = [...kdeData.hist_labels].reverse();
    let histCounts = [...kdeData.hist_counts];
    // sort number label desc
    const hisLabels = [...kdeData.hist_labels].sort((a, b) => b - a);
    if (JSON.stringify(hisLabels) === JSON.stringify(labelReversed)) {
        histCounts = histCounts.reverse();
    }
    const [, maxKDE] = findMinMax(kdes);
    const [, maxHist] = findMinMax(histCounts);
    const transKDE = kdes.map(i => maxHist * i / maxKDE);
    return {
        transKDE,
        hisLabels,
        histCounts,
    };
};

const transformDatetimeRange = (formData) => {
    const datetimeRangeKeys = ['DATETIME_RANGE_PICKER', 'START_DATE', 'END_DATE', 'START_TIME', 'END_TIME'];
    const validDatetimeRanges = formData.getAll(datetimeRangeKeys[0])
        .filter(value => value !== '');
    if (validDatetimeRanges.length) {
        // to remove empty datetime range from terms
        datetimeRangeKeys.forEach(key => formData.delete(key));
        validDatetimeRanges.forEach((value) => {
            formData.append('DATETIME_RANGE_PICKER', value);
            const [startDate, startTime, , endDate, endTime] = value.split(' ');
            formData.append('START_DATE', startDate);
            formData.append('START_TIME', startTime);
            formData.append('END_DATE', endDate);
            formData.append('END_TIME', endTime);
        });
    }
    // assign start/end datetime
    return formData;
};

// bind catetory variable stp and rlp new gui
const transformCategoryVariableParams = (formData, procConf) => {
    // check devideOption
    const devideOption = formData.get('compareType');
    if (devideOption === 'var' || devideOption === 'category') {
        const catExpVal = formData.get('catExpBox1') || formData.get('catExpBox2') || formData.get('catExpBox');
        let endProcCate = null;
        if (catExpVal) {
            const [procObj] = Object.values(procConf).filter(proc => proc.getColumnById(catExpVal));
            if (procObj) {
                endProcCate = procObj.id;
            }
        }
        formData.set('end_proc_cate1', endProcCate);
        formData.set('GET02_CATE_SELECT1', catExpVal);
        formData.set('categoryVariable1', catExpVal);
        formData.set('categoryValueMulti1', 'NO_FILTER'); // default
    }
    let startProc = formData.get('start_proc');
    if (!startProc || startProc === 'null') {
        startProc = formData.get('end_proc1') || null;
        formData.set('start_proc', startProc);
    }
    if (!formData.get('START_DATE')) {
        let startDate = '';
        let startTime = '';
        let endDate = '';
        let endTime = '';
        const fullDate = formData.get('DATETIME_RANGE_PICKER');
        if (fullDate) {
            [startDate, startTime, , endDate, endTime] = fullDate.split(' ');
        }
        formData.set('START_DATE', startDate);
        formData.set('START_TIME', startTime);
        formData.set('END_DATE', endDate);
        formData.set('END_TIME', endTime);
    }
    return formData;
};

const transformCategoryTraceTime = (formData, eleIdPrefix) => {
    const traceTime1 = formData.get(`${eleIdPrefix}TraceTime1`);
    const traceTime = formData.get('traceTime') || null;
    if (!traceTime1 && !traceTime) {
        formData.set(`${eleIdPrefix}TraceTime1`, traceTime);
    }
    return formData;
};

const transformCHMParams = (formData) => {
    // set params
    const catExpVal = formData.get('catExpBox1') || formData.get('catExpBox2') || formData.get('catExpBox');
    if (catExpVal) {
        formData.set('categoryVariable1', catExpVal);
        formData.set('categoryValueMulti1', 'NO_FILTER'); // default
    }


    if (!formData.get('START_DATE')) {
        transDatetimeRange(formData);
    }

    if ([...formData.keys()].includes('catExpBox1')) {
        // remove catExpBox1
        formData.delete('catExpBox1');
    }

    return formData;
};

const transformSKDParam = (formData, procConf) => {
    const objectiveVarID = formData.get('objectiveVar');
    const valsSelected = formData.getAll('GET02_VALS_SELECT1');
    const setEndProcs = () => {
        const endProcs = [...formData.keys()].filter(
            key => key.includes('end_proc'),
        );
        if (endProcs.length) {
            endProcs.forEach((key) => {
                const [, procCountId] = key.split('end_proc');
                formData.set(`end_proc_cate${procCountId}`, formData.get(key));
            });
        }
    };
    // const endProcCate = formData.get('objectiveVar');
    let endProcObjective = null;
    if (objectiveVarID) {
        const [procObj] = Object.values(procConf).filter(proc => proc.getColumnById(objectiveVarID));
        if (procObj) {
            endProcObjective = procObj.id;
        }
    }
    if (endProcObjective) {
        // transform end procs
        setEndProcs();
        formData.set('end_proc1', endProcObjective);
        valsSelected.forEach((value) => {
            formData.append('GET02_CATE_SELECT1', value);
        });

        formData.set('GET02_VALS_SELECT1', objectiveVarID);
        formData.delete('objectiveVar');
    }
    return formData;
};

const transDatetimeRange = (formData) => {
    const fullDate = formData.get('DATETIME_RANGE_PICKER');
    const datetimeKeys = ['START_DATE', 'START_TIME', 'END_DATE', 'END_TIME'];
    if (fullDate) {
        const [startDate, startTime, , endDate, endTime] = fullDate.split(' ');
        datetimeKeys.forEach(key => formData.delete(key));
        formData.set('START_DATE', startDate);
        formData.set('START_TIME', startTime);
        formData.set('END_DATE', endDate);
        formData.set('END_TIME', endTime);
    }
    return formData;
};

// convert hsv color to rgb
const hsv2rgb = ({ h, s, v }) => {
    const f = (n, k = (n + h / 60) % 6) => v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
    const rgb = [f(5), f(3), f(1)].map(value => value * 255);
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
};

const downloadCsvFile = (fileName, csvContent) => {
    const header = 'data:text/csv;charset=utf-8-sig,';
    const encodedUri = encodeURI(header + csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', fileName);
    document.body.appendChild(link); // Required for FF

    link.click(); // This will download the data file named "my_data.csv".
    document.body.removeChild(link);
};

const getCurrentTimeStr = () => {
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60 * 1000;
    const dateLocal = new Date(now.getTime() - offsetMs);
    const timeStr = dateLocal.toISOString().slice(0, 23).replace(/[-:]/g, '').replace('T', '_');
    return timeStr;
};

const downloadTextFile = (url, filename = null) => {
    fetch(url)
        .then(response => response.blob())
        .then((blob) => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            if (filename) {
                link.download = filename;
            }
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        })
        .catch(console.error);
};

// formData is FormData object
const chooseCyclicTraceTimeInterval = (formData) => {
    if (!formData) return formData;
    const traceTimes = [...formData.keys()].filter(e => e.match(/.+TraceTime\d+/));
    const traceTimeOptions = traceTimes.map(e => formData.get(e));

    const divisionNum = formData.get(CYCLIC_TERM.DIV_NUM);
    const intervalNum = formData.get(CYCLIC_TERM.INTERVAL);
    const windowsLengthNum = formData.get(CYCLIC_TERM.WINDOW_LENGTH);

    const targetDate = traceTimeOptions[0] === TRACE_TIME_CONST.RECENT
        ? moment().format('YYYY-MM-DD') : formData.get(START_DATE);
    const targetTime = traceTimeOptions[0] === TRACE_TIME_CONST.RECENT
        ? moment().format('HH:mm') : formData.get(START_TIME);

    // clear all datetimes before customize
    [START_DATE, START_TIME, END_DATE, END_TIME].forEach(e => formData.delete(e));

    traceTimeOptions.forEach((traceTimeOption, i) => {
        const [startTimeRange, endTimeRange] = traceTimeOption === TRACE_TIME_CONST.FROM ? getEndTimeRange(
            targetDate, targetTime, divisionNum, intervalNum, windowsLengthNum,
        ) : getStartTimeRange(
            traceTimeOption, targetDate, targetTime, divisionNum, intervalNum, windowsLengthNum,
        );

        formData.append(START_DATE, startTimeRange[0]);
        formData.append(START_TIME, startTimeRange[1]);
        formData.append(END_DATE, endTimeRange[0]);
        formData.append(END_TIME, endTimeRange[1]);
    });

    return formData;
};

/**
 *
 * @param name
 * @param option: object {MIN: 0,
 *                        MAX: 0,
 *                        DEFAULT: 0}
 *
 */
function validateInputByNameWithOnchange(name, option) {
    if (!name) return;

    $(`input[name=${name}]`).on('change', (e) => {
        //uncheck if disabled
        if (e.target.disabled) return;

        const { value } = e.currentTarget;
        if (!value || (value < option.MIN && value !== 0)) {
            e.currentTarget.value = option.MIN;
            showToastrMsg(i18nCommon.changedToMaxValue, i18nCommon.warningTitle);
        }
        if (value > option.MAX) {
            e.currentTarget.value = option.MAX;
            showToastrMsg(i18nCommon.changedToMaxValue, i18nCommon.warningTitle);
        }

        if ((Math.abs(Number(value)) < option.DEFAULT && value > option.MIN)) {
            e.currentTarget.value = option.DEFAULT;
            showToastrMsg(i18nCommon.changedToMaxValue, i18nCommon.warningTitle);
        }
    });
}

const copyTextToClipboard = (url) => {
    fetch(url)
        .then(response => response.blob())
        .then((blob) => {
            const reader = new FileReader();
            reader.onload = function () {
                navigator.clipboard.writeText(reader.result);
            };
            reader.readAsText(blob);
        })
        .catch(console.error);
};

const getFilterItemDetail = (procCond, condition, filterType) => {
    const listCond = Array.isArray(condition) ? condition
        : (condition !== 'NO_FILTER' ? [condition] : []);
    const filterItems = [];
    if (listCond.length) {
        listCond.forEach((item) => {
            const partNoFilters = getFilterByTypes(procCond, filterType);
            const filterItemIndex = partNoFilters[0].indexOf(Number(item));
            filterItems.push(partNoFilters[1][filterItemIndex]);
        });
    }
    return filterItems;
};

// get conditions
const getConditionFromSetting = (traceDat) => {
    const conditions = traceDat[COMMON][CONDT] || [];
    const filters = [];
    if (conditions.length) {
        conditions.forEach((condition) => {
            filterInfo = {};
            const procCond = procConfigs[condition.cond_proc] || null;
            filterInfo.proc_name = procCond ? procCond.name : '';
            filterInfo.items = {};

            if (condition[FILTER_PARTNO]) {
                // partnumber
                filterInfo.items.part_no = getFilterItemDetail(procCond, condition[FILTER_PARTNO], CfgFilter.filterTypes.PART_NO);
            }
            if (condition[FILTER_LINE]) {
                // line
                filterInfo.items.line = getFilterItemDetail(procCond, condition[FILTER_LINE], CfgFilter.filterTypes.LINE);
            }

            if (condition[FILTER_MACH]) {
                // machine
                filterInfo.items.machine = getFilterItemDetail(procCond, condition[FILTER_MACH], CfgFilter.filterTypes.MACHINE);
            }

            // TODO: filter others
            // filters.items.others = getFilterItemDetail(procCond, condition[CONST.FILTER_OTHER], CfgFilter.filterTypes.OTHER);
            filters.push(filterInfo);
        });
    }
    return filters;
};

const genInfoTableBody = (traceDat) => {
    const startProc = procConfigs[traceDat[COMMON].start_proc];
    const startProcName = startProc ? startProc.name : '';
    const startDateTime = `${traceDat[COMMON][START_DATE]} ${traceDat[COMMON][START_TIME]}`;
    const endDateTime = `${traceDat[COMMON][END_DATE]} ${traceDat[COMMON][END_TIME]}`;
    let settingDOM = '';
    const filters = getConditionFromSetting(traceDat);
    const startTime = moment(`${startDateTime}Z`).format(DATE_FORMAT_WITHOUT_TZ);
    const endTime = moment(`${endDateTime}Z`).format(DATE_FORMAT_WITHOUT_TZ);
    settingDOM += `<tbody>
                        <tr>
                            <td>${i18nCommon.startPoint}</td>
                            <td>${startProcName}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>From</td>
                            <td>${startTime}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>To</td>
                            <td>${endTime}</td>
                            <td></td>
                         </tr>`;

    if (filters.length) {
        filters.forEach((filter, k) => {
            // use filter label in first column of first filter item
            if (k === 0) {
                settingDOM += `<tr>
                    <td>${i18nCommon.filter}</td>
                    <td>${filter.proc_name}</td>
                    <td></td>
                </tr>`;
            } else {
                settingDOM += `<tr><td></td><td>${filter.proc_name}</td><td></td></tr>`;
            }
            if (filter.items.line && filter.items.line.length) {
                settingDOM += `<tr><td></td><td>${i18nCommon.line}</td><td>`;
                filter.items.line.forEach((line, k) => {
                    settingDOM += `${line || i18nCommon.allSelection}`;
                    if (k !== filter.items.line.length - 1) {
                        settingDOM += ', ';
                    }
                });
                settingDOM += '</td></tr>';
            }
            if (filter.items.machine && filter.items.machine.length) {
                settingDOM += `<tr><td></td><td>${i18nCommon.mach}</td><td>`;
                filter.items.machine.forEach((machine, k) => {
                    settingDOM += `${machine}`;
                    if (k !== filter.items.machine.length - 1) {
                        settingDOM += ', ';
                    }
                });
                settingDOM += '</td></tr>';
            }
            if (filter.items.part_no && filter.items.part_no.length) {
                settingDOM += `<tr><td></td><td>${i18nCommon.partNo}</td><td>`;
                filter.items.part_no.forEach((partNo, k) => {
                    settingDOM += `${partNo}`;
                    if (k !== filter.items.part_no.length - 1) {
                        settingDOM += ', ';
                    }
                });
                settingDOM += '</td></tr>';
            }
        });
    }
    settingDOM += '</tbody>';
    return settingDOM;
};

const showInfoTable = (traceDat, tableId = 'setting-infor-table') => {
    const body = genInfoTableBody(traceDat);
    $(`#${tableId}`).html(body);
};

const getLastNumberInString = (inputStr) => {
    const result = inputStr.match(/\d+$/);
    if (result) {
        return Number(result[0]);
    }

    return null;
};

const zipExport = (datasetId) => {
    const filename = $('#currentLoadSettingLbl').html();
    const exportModeEle = $('[name=isExportMode]');
    const url = `/histview2/api/fpp/zip_export?dataset_id=${datasetId}&user_setting_id=${exportModeEle.val()}`;
    downloadTextFile(url, `${filename}.zip`);
    exportModeEle.remove();
    return false;
};

const zipImport = () => {
    const filename = $('#importSelectFileInput').val();
    if (!filename) {
        return;
    }

    const url = `/histview2/api/fpp/zip_import?filename=${filename}`;
    fetch(url)
        .then(response => response.clone().json())
        .then((json) => {
            const userSettingId = json.id;
            const redirectPage = json.page;
            goToSettingPage(userSettingId, redirectPage, filename);
        })
        .catch(console.error);
};

const handleZipExport = (res) => {
    const exportModeEle = $('[name=isExportMode]');
    // export mode
    if (!exportModeEle.val()) {
        return;
    }

    zipExport(res.isExportMode || res.responseJSON.dataset_id);
};


const rightClickHandler = (e, contextMenuEle) => {
    e.preventDefault();
    e.stopPropagation();

    // show context menu when right click heatmap
    const menu = $(contextMenuEle);
    const menuHeight = menu.height();
    const windowHeight = $(window).height();
    const left = e.clientX;
    let top = e.clientY;
    if (windowHeight - top < menuHeight) {
        top -= menuHeight;
    }
    menu.css({
        left: `${left}px`,
        top: `${top}px`,
        display: 'block',
    });

    return false;
};


const overrideUiSortable = () => {
    // override jQuery UI draggable
    const mouseCopy = $.extend({}, $.ui.mouse.prototype);

    $.extend($.ui.mouse.prototype, {
        _mouseInit: function () {
            const that = this;
            if (!this.options.mouseButton) {
                this.options.mouseButton = 1;
            }

            mouseCopy._mouseInit.apply(this, arguments);

            if (this.options.mouseButton === 3) {
                this.element.bind(`contextmenu.${this.widgetName}`, (event) => {
                    if ($.data(event.target, `${that.widgetName}.preventClickEvent`) === true) {
                        $.removeData(event.target, `${that.widgetName}.preventClickEvent`);
                        event.stopImmediatePropagation();
                        return false;
                    }
                    event.preventDefault();
                    return false;
                });
            }

            this.started = false;
        },
        _mouseDown: function (event) {
            if (this.options.mouseButton === 1) {
                const isGraphTarget = event.target.closest('.nsewdrag.drag');
                if (isGraphTarget) return;
            }

            // we may have missed mouseup (out of window)
            (this._mouseStarted && this._mouseUp(event));

            this._mouseDownEvent = event;

            const that = this;
            const btnIsLeft = (event.which === this.options.mouseButton);
            // event.target.nodeName works around a bug in IE 8 with
            // disabled inputs (#7620)
            const elIsCancel = (typeof this.options.cancel === 'string' && event.target.nodeName ? $(event.target).closest(this.options.cancel).length : false);
            if (!btnIsLeft || elIsCancel || !this._mouseCapture(event)) {
                return true;
            }

            this.mouseDelayMet = !this.options.delay;
            if (!this.mouseDelayMet) {
                this._mouseDelayTimer = setTimeout(() => {
                    that.mouseDelayMet = true;
                }, this.options.delay);
            }

            if (this._mouseDistanceMet(event) && this._mouseDelayMet(event)) {
                this._mouseStarted = (this._mouseStart(event) !== false);
                if (!this._mouseStarted) {
                    event.preventDefault();
                    return true;
                }
            }

            // Click event may never have fired (Gecko & Opera)
            if ($.data(event.target, `${this.widgetName}.preventClickEvent`) === true) {
                $.removeData(event.target, `${this.widgetName}.preventClickEvent`);
            }

            // these delegates are required to keep context
            this._mouseMoveDelegate = function (event) {
                return that._mouseMove(event);
            };
            this._mouseUpDelegate = function (event) {
                return that._mouseUp(event);
            };
            $(document)
                .bind(`mousemove.${this.widgetName}`, this._mouseMoveDelegate)
                .bind(`mouseup.${this.widgetName}`, this._mouseUpDelegate);

            event.preventDefault();

            mouseHandled = true;
            return true;
        },
    });
};

const updateDatetimeRange = () => {
    $('input[name=DATETIME_RANGE_PICKER]').change();
};
