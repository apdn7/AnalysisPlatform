import io
import itertools
import pickle
import re
import unicodedata
import datetime
from collections import Counter
from itertools import tee

import numpy as np
import pandas as pd

from histview2.common.constants import *
from histview2.common.logger import logger
from histview2.common.services.normalization import normalize_list


def load_pkl(filename):
    with open(filename, 'rb') as f:
        return pickle.load(f)


def get_file_info_py(target_file):
    no_data_error = 'NoDataError'
    error_type = 'err_type'

    is_empty_file = False
    try:
        out = filechecker(fpath=target_file)
    except Exception as e:
        logger.error(e)
        return e, is_empty_file

    if out:
        error = out.get('err', None)
        if error:
            logger.error(error)
            error_type = out.get(error_type, None)
            if error_type == no_data_error:
                is_empty_file = True
            return None, is_empty_file
        else:
            return out, is_empty_file

    return None, is_empty_file


# this func use R script
# def get_file_info(target_file):
#     dir_out = get_data_path()
#     dir_wrapr = get_wrapr_path()
#     file_check_func = 'filecheckr'
#     r_file_check = 'FileCheckr_20-06-02.R'
#     no_data_error = 'NoDataError'
#     error_type = 'err_type'
#
#     # define parameters
#     dic_data = {}  # filecheckr does not need input data
#     dic_task = dict(func=file_check_func, file=r_file_check, fpath=target_file)
#
#     # define and run pipeline
#     is_empty_file = False
#     try:
#         pipe = wrapr_utils.RPipeline(dir_wrapr, dir_out)
#         out = pipe.run(dic_data, [dic_task])
#     except Exception as e:
#         logger.error(e)
#         return e, is_empty_file
#
#     if out:
#         error = out.get('err', None)
#         if error:
#             logger.error(error)
#             error_type = out.get(error_type, None)
#             if error_type == no_data_error:
#                 is_empty_file = True
#             return None, is_empty_file
#         else:
#             res = load_pkl(out['fname_out'])
#             res = res['results']
#             res = dict(res)
#             return res, is_empty_file
#
#     return None, is_empty_file


def get_skip_head(wrapr):
    return int(wrapr['info']['skip'])


def get_skip_tail(wrapr):
    return 1


def get_columns_name(wrapr):
    return list(wrapr['head']['main'])


def get_efa_header_flag(wrapr):
    return wrapr['info'].get('efa_header_exists') or False


def get_data_type(wrapr):
    data_types = []
    col_types = [data_type.lower() for data_type in wrapr['type']['class']]
    for data_type in col_types:
        if data_type in ['character', 'string']:
            data_types.append(DataType.TEXT.value)
        elif data_type in ['date', 'time', 'datetime', 'datetime64']:
            data_types.append(DataType.DATETIME.value)
        elif data_type in ['real', 'numeric']:
            data_types.append(DataType.REAL.value)
        elif data_type in ['int', 'integer', 'integer64']:
            data_types.append(DataType.INTEGER.value)
        else:
            data_types.append(DataType.TEXT.value)

    return data_types


def get_etl_headers(wrapr):
    etl_headers = {
        WR_HEADER_NAMES: [],
        WR_VALUES: [],
        WR_TYPES: [],
        WR_HEAD: [],
    }
    if not wrapr:
        return etl_headers

    # Get first True value from wrapr.head.rplc
    header_pos = None
    for idx, val in enumerate(wrapr[WR_HEAD][WR_RPLC]):
        if val:
            header_pos = idx
            break

    if header_pos is None:
        return etl_headers

    dic_header = wrapr[WR_CTGY]
    header_names = list(dic_header)
    values = [dic_header[name][header_pos] for name in header_names]

    etl_headers[WR_HEADER_NAMES] = normalize_list(header_names)
    etl_headers[WR_VALUES] = normalize_list(values)
    for val in values:
        try:
            int(val)
            if '.' in str(val):
                dtype = DataType.REAL.value
            else:
                dtype = DataType.INTEGER.value
        except Exception:
            dtype = DataType.TEXT.value

        etl_headers[WR_TYPES].append(dtype)

    # etl_headers[WR_TYPES] = [DataType.TEXT.value] * len(header_names)
    return etl_headers


def merge_etl_heads(new_vals, data):
    return [row + new_vals for row in data]


# ----- Filechecker -----

def filechecker(fpath: str, nrows_to_check=20) -> dict:
    ''' Analyze dsv files

    Inputs:
        fpath (str) Path to csv/tsv
        nrows_to_check (int) Maximum number of rows to check for encoding estimation

    Returns:
        results (dict)
        - info  (dict) Basic info: encoding, separator, na string, rows to skip.
        - head  (pd.DataFrame) Header info. Column names and units.
        - type  (pd.DataFrame) Datatype info. Datetime/string/numeric/integer.
        - ctgy  (pd.DataFrame) Category info. (Machine, Line, Process)
    '''

    results = dict(info=None, head=None, type=None, ctgy=None)

    # read as list
    encd = guess_encoding_simply(fpath)
    dlist = read_first_nrows_as_list(fpath, nrows_to_check, encd, del_newline=True)
    if len(dlist) == 0:
        return {'err': 'NoDataError: No data in file', 'err_type': 'NoDataError'}

    sep_str = guess_delimeter(dlist, candidates=[',', '\t', ';'])
    ncols = guess_number_of_columns(dlist, delimeter=sep_str)

    # read as array
    arr_dat = read_first_nrows_as_array(fpath, 20, ncols, sep_str, encd)
    nas = guess_na_str(arr_dat)

    # parse header
    info = dict(encd=encd, sepr=sep_str, ncol=ncols, na_s=nas['str'], expt=nas['exc'])
    hdr = parse_header(dlist, arr_dat, info)
    if len(hdr['row']) == 0:
        print("No header detected")
    info['skip'] = hdr['skip']
    head = summarize_header_as_df(hdr, info)
    ctgy = summarize_category_as_df(hdr, info, head['main'].values)
    if arr_dat.shape[0] == hdr['end']:
        return {'err': 'NoDataError: No header detected', 'err_type': 'NoDataError'}

    # guess_datatypes
    df = read_main_text_as_df(fpath, info, 100, head['main'], hdr['is_header_detected'])
    dtypes = guess_datatypes(df)
    head['escp'] = guess_escape_strings(df)

    results = dict(info=info, head=head, type=dtypes, ctgy=ctgy)
    return results


# =========================
# Read header
# =========================

def guess_encoding_simply(fpath: str, max_rows=100) -> str:
    ''' Very simple file encoding estimator
    Just try utf-8 and shift-jis.
    Assume that we can not open shift-jis file with utf-8.
    '''
    try:
        encd = 'utf-8'
        _ = read_first_nrows_as_list(fpath, max_rows, encd)
    except UnicodeDecodeError:
        encd = 'shift_jis'
        _ = read_first_nrows_as_list(fpath, max_rows, encd)

    return encd


def read_first_nrows_as_list(fpath: str, nrows: int, encd: str, del_newline=False) -> list:
    ''' Read a text file as a list
    Each element corresponds to a row of text file.
    File encoding must be estimated beforehand.
    '''
    dat = []
    with open(fpath, encoding=encd) as f:
        try:
            for _ in range(nrows):
                dat.append(next(f))
        except StopIteration:
            pass
    if del_newline:
        dat = _remove_newline_str(dat)
    return dat


def read_first_nrows_as_array(fpath: str, nrows: int, ncols: int, sep_str: str, encd: str):
    ''' Read a text file as a NumpyArray
    File encoding, separator, and number of columns must be estimated beforehand.
    '''
    dat = np.full((nrows, ncols), '', dtype=object)
    with open(fpath, encoding=encd) as f:
        try:
            for row in range(nrows):
                vals = next(f).split(sep_str)
                dat[row, :len(vals)] = np.array(_remove_newline_str(vals))
        except StopIteration:
            dat = dat[:row, :]
            pass
    return dat


def _remove_newline_str(x: list, newline_str='\n') -> list:
    x = [x.rstrip(newline_str) for x in x]
    return x


# =========================
# Guess delimeter / number of columns
# =========================

def guess_delimeter(x: list, candidates=[',', '\t', ';']) -> str:
    ''' Guess delimeter from a list of strings
    The character which maximizes the minimum of occurrence is estimated as a delimeter.
    Note that this is just a heuristic.
    '''
    ed_row = np.max([0, len(x) - 1])
    st_row = np.max([0, ed_row - 10])
    rows_to_check = np.arange(st_row, ed_row)
    x_to_check = [x[i] for i in rows_to_check]

    delim_cnts = _count_characters(x_to_check, candidates)
    min_delim_cnts = np.min(delim_cnts, axis=0)
    sep_str = candidates[np.argmax(min_delim_cnts)]
    return sep_str


def _count_characters(x: list, charlist: list):
    ''' Count occurrence of characters in each element of x
    '''
    cnts = np.zeros((len(x), len(charlist)))
    for (i, row) in enumerate(range(len(x))):
        chr_counter = Counter(x[row])
        cnts[i, :] = [chr_counter[char] for char in charlist]
    return cnts


def guess_number_of_columns(x: list, delimeter: str) -> int:
    ''' Guess number of columns from a list of strings
    Take the maximum count of delimeters + 1
    '''
    delim_cnts = [text.count(delimeter) for text in x]
    ncols = np.max(delim_cnts) + 1  # e.g. one separator means 2 columns
    return ncols


# =========================
# Parse header
# =========================

def parse_header(x, arr_dat, info: dict) -> dict:
    ''' Get positions and category info of header
    '''
    # does header exist?
    hdr = guess_where_header_is(x, info)
    hdr['is_header_detected']

    # trim whitespace on each element
    def trimws(x):
        return x.strip()

    inf = arr_dat.copy()[:(hdr['end'] + 1), :]
    inf = np.vectorize(trimws)(inf)

    values, lengths = rle(inf[hdr['main'], :].flatten())
    values[:] = np.full(len(values), 1)
    values[np.where(lengths != 1)] = "0"

    hdm = dict(uni=np.equal(inverse_rle(values, lengths), np.array("1", dtype=object)))
    hdr['hdm'] = hdm

    # Get special dsv header information
    hdr['uni'] = np.full(info['ncol'], "", dtype=object)
    hdr['sb0'] = np.full(info['ncol'], "", dtype=object)
    is_known_struct = is_known_header(inf[:, 0])
    if is_known_struct:
        hdr = parse_known_header(hdr, inf, info)

    hdr['act'] = hdr['uni'] != ""
    hdr['skip'] = hdr['end']
    hdr['inf'] = inf
    return hdr


def guess_where_header_is(x: list, info: dict) -> dict:
    dic_hdr = dict(lst=None, msk=None, str=None, nch=None, flg=None,
                   top=0, end=0, main=None, skip=0, is_header_detected=None,
                   ctg=None, inf=None, act=None, hdm=None, uni=None, sb0=None)

    header_starts_from = guess_where_header_starts(x, delimeter=info['sepr'], ncols=info['ncol'])
    row_idx_candidate = np.arange(header_starts_from, len(x))
    if len(row_idx_candidate) > 10:
        row_idx_candidate = row_idx_candidate[:10]

    x_masked = []
    msk = gen_header_mask(info['sepr'], info['na_s'], info['expt'])
    for row in row_idx_candidate:
        x_masked.append(re.sub(msk, "", x[row]))

    nchars_in_each_row = [len(text) for text in x_masked]
    hdr_flgs = seems_like_header(nchars_in_each_row)
    hdr_rows = row_idx_candidate[hdr_flgs]

    dic_hdr['msk'] = msk
    dic_hdr['str'] = x_masked
    dic_hdr['nch'] = nchars_in_each_row
    dic_hdr['flg'] = hdr_flgs
    dic_hdr['row'] = hdr_rows
    dic_hdr['is_header_detected'] = len(hdr_rows) > 0
    if len(hdr_rows) > 0:
        num_informative_cols = guess_number_of_informative_cols(x, info['sepr'])
        is_full_row = np.array(num_informative_cols) == info['ncol']
        dic_hdr['top'] = np.min(hdr_rows)
        dic_hdr['end'] = np.max(hdr_rows)
        dic_hdr['main'] = np.intersect1d(hdr_rows, np.where(is_full_row)[0])
    return dic_hdr


def guess_where_header_starts(x: list, delimeter: str, ncols: int) -> int:
    nsep = [text.count(delimeter) for text in x]
    rows_with_full_vals = np.where(nsep == (ncols - 1))[0]
    if len(rows_with_full_vals) == 1:
        return rows_with_full_vals

    # detect continuous row group
    diff_rows = np.diff(rows_with_full_vals)
    values, lengths = rle(diff_rows)
    grp = np.max(np.where(values == 1)[0])

    # select first row in continuous row group
    grps_to_ignore = np.setdiff1d(np.arange(1, len(values)), grp)
    values[grps_to_ignore] = 0
    reversed_values = inverse_rle(values, lengths)
    rows_in_grp = rows_with_full_vals[np.where(reversed_values == 1)[0]]
    header_starts_from = np.min(rows_in_grp)
    return header_starts_from


def gen_header_mask(sep_str: str, na_s, expt) -> str:
    # Generate regex string for masking
    msk = sep_str
    if len(na_s) > 0:
        exceptions = list(itertools.chain.from_iterable([sep_str, na_s]))
        msk = "|".join(exceptions)
    if len(expt) > 0:
        exceptions = list(itertools.chain.from_iterable([msk, expt]))
        msk = "|".join(exceptions)
    msk = "(" + msk + "|/|:|\\d+(\\.|,| )?)"
    return msk


def seems_like_header(nchars_in_each_row):
    # Determine header or not by number of characters
    # if data has only one row, treat that row as header
    if len(nchars_in_each_row) == 1:
        return True
    # assume that there is no header
    flg = [x < 0 for x in nchars_in_each_row]
    med = np.median(nchars_in_each_row)
    # in case with header
    if med > 0:
        if (np.max(nchars_in_each_row) / med) > 1.5:
            flg = nchars_in_each_row > med
    return flg


def guess_number_of_informative_cols(x: list, delimeter: str) -> list:
    ''' Guess number of "Informative" columns on each row
    Here, informative means that a value is stored in an element.
    '''
    reg_nul = "(" + delimeter + " *" + delimeter + "|" + delimeter + " *$)"
    nsep = [len(re.findall(delimeter, text)) for text in x]
    dsv = [re.sub(reg_nul, "", text) for text in x]
    ncol = [len(re.findall(delimeter, text)) + 1 for text in dsv]
    return ncol


def is_known_header(x) -> bool:
    known_header = ["検索期間", "ライン", "工程", "設備", "特性名", "", ""]
    if len(x) < len(known_header):
        return False
    for i in range(len(known_header)):
        if x[i] != known_header[i]:
            return False
    return True


def parse_known_header(hdr, inf, info) -> dict:
    # Get category of machine
    ma0 = np.array([re.sub("#N/A", "-", text) for text in inf[3, :]])
    ma0[0] = ""
    machine_values, machine_lengths = rle(ma0)

    # Shifted position to repeat (to the right side to fill the empty cells)
    for i in range(1, len(machine_values)):
        if machine_values[i] == "":
            machine_values[i] = machine_values[i - 1]

    ctg = dict(mac=inverse_rle(machine_values, machine_lengths),
               lin=np.full(info['ncol'], re.sub("#N/A", "-", inf[1, 1])),
               prc=np.full(info['ncol'], re.sub("#N/A", "-", inf[2, 1])))

    hdr['ctg'] = ctg
    hdr['uni'] = inf[5, :]
    hdr['sb0'] = inf[4, :]
    hdr['sb0'][0] = ""
    hdr['sb1'] = inf[6, :]
    hdr['if1'] = inf[0, :]
    chars_if1 = np.array([len(text) for text in hdr['if1']])
    hdr['if1'] = hdr['if1'][np.where(chars_if1 > 0)[0]]
    return hdr


# =========================
# Summarize
# =========================

def summarize_header_as_df(hdr: dict, info: dict):
    ''' Summarize header info to data frame
    Column names are translated/normalized.
    Units are extracted.
    If Column names are duplicated, suffix is added (e.g. _01)
    '''
    # header information
    head = dict(base=hdr['inf'][hdr['main'], :].flatten(),
                rplc=np.logical_and(np.logical_not(hdr['hdm']['uni']), hdr['act']))

    if np.sum(head['rplc']) > 0:
        head['main'] = head['base'].copy()
        head['long'] = head['base'].copy()
        idx = np.where(head['rplc'])[0]
        head['main'][idx] = hdr['uni'][idx].copy()
        head['long'][idx] = hdr['sb0'][idx].copy()
    else:
        # extract text before :
        head['main'] = np.array([text.split(":")[0] for text in head['base']])
        if len(head['main']) > 1:
            head['long'] = head['main'].copy()
        else:
            head['long'] = np.full(info['ncol'], "")

    # NFKC normalization (e.g. zenkaku -> hankaku)
    head['main'] = [unicodedata.normalize("NFKC", text) for text in head['main']]
    head['long'] = [unicodedata.normalize("NFKC", text) for text in head['long']]

    # extract units
    units = _split_colnames_from_unit(head['long'])
    head['units'] = units['unit']
    head['user'] = [x + y for x, y in zip(units['colname'], units['suffix'])]
    # translate
    head['main'] = _translate_wellknown_jp2en(head['main'])
    # if head$main has some same value, add _01, _02, ...
    head['main'] = add_suffix_if_duplicated(head['main'])

    df_head = pd.DataFrame(head, index=head['main'])
    return df_head


def summarize_category_as_df(hdr: dict, info: dict, col_names: list):
    ''' Summarize category (Machine, Line, Process) info to data frame
    '''
    ctgy = dict(Machine=np.full(info['ncol'], ""),
                Line=np.full(info['ncol'], ""),
                Process=np.full(info['ncol'], ""))

    if hdr['ctg'] != None:
        if len(hdr['ctg']['mac']) > 0:
            ctgy['Machine'] = hdr['ctg']['mac']
        if len(hdr['ctg']['lin']) > 0:
            ctgy['Line'] = hdr['ctg']['lin']
        if len(hdr['ctg']['prc']) > 0:
            ctgy['Process'] = hdr['ctg']['prc']

    df_ctgy = pd.DataFrame(ctgy, index=col_names)
    return df_ctgy


def _split_colnames_from_unit(x) -> dict:
    units = dict(raw=x, colname=x, unit=np.full(len(x), ""), suffix=np.full(len(x), ""))
    x_split = [re.split(" \\[|\\] |\\[|\\]", text) for text in x]
    is_unit_detected = np.max([len(split) for split in x_split]) > 0
    if is_unit_detected:
        units['colname'] = [x[0] for x in x_split]
        units['unit'] = [x[1] if len(x) > 1 else "" for x in x_split]
        units['suffix'] = [x[2] if len(x) > 2 else "" for x in x_split]
    return units


def _translate_wellknown_jp2en(x):
    fromto = dict(製品="Product", ロット="Lot", 内="Internal", 日時="DateTime",
                  時間="Time", 品番="PartsNo", シリアル="Serial", ナンバー="Number",
                  実績種別="ResultCategory", 番号="No", コード="Code", トレー="Tray",
                  測定値="Measurement", 判定="Result", 作業者="Worker")

    for key, val in fromto.items():
        x = [text.replace(key, val) for text in x]
    return x


def add_suffix_if_duplicated(x):
    duplicated = [k for k, v in Counter(x).items() if v > 1]
    if len(duplicated) == 0:
        return x
    suffix_format = (f'_{str(x).zfill(2)!s}' for x in range(1, 100))
    dic_suffix = dict(zip(duplicated, tee(suffix_format, len(duplicated))))
    for idx, s in enumerate(x):
        try:
            suffix = str(next(dic_suffix[s]))
        except KeyError:
            continue
        else:
            x[idx] += suffix
    return x


# =========================
# Guess datatypes
# =========================


def read_main_text_as_df(fpath: str, info: dict, max_rows=100, col_names=None, header=False):
    ''' Based on estimated header position, read data as pd.DataFrame
    Remove leading single quotes
    '''
    str_to_remove = "^'|(?<=" + info['sepr'] + ")(')"
    x = read_first_nrows_as_list(fpath, nrows=max_rows, encd=info['encd'], del_newline=True)
    x = [re.sub(str_to_remove, "", text) for text in x]
    x = [x[row] for row in range(len(x)) if row >= info['skip'] + header]
    df = pd.read_csv(io.StringIO('\n'.join(x)), sep=r',', header=None, names=col_names,
                     na_values=[''] + info['na_s'], dtype=str)
    return df


def guess_datatypes(df) -> list:
    dtypes = []
    intg = []
    real = []
    dati = []
    for col in df.columns.values:
        uniq_vals = df[col].dropna().unique()
        dtypes.append(_guess_datatype(uniq_vals))
        intg.append(_can_parse_as_integer(uniq_vals))
        real.append(_can_parse_as_numeric(uniq_vals))
        dati.append(_can_parse_as_datetime(uniq_vals))

    types = pd.DataFrame({'class': dtypes, 'intg': intg, 'real': real, 'dati': dati},
                         index=df.columns.values)
    return types


def _guess_datatype(uniq_vals) -> str:
    ''' Guess datatype of given arrray
    '''

    # initial guess
    if len(uniq_vals) == 0:
        return "logical"
    if _leading_zero_exists(uniq_vals):
        return "string"

    # datetime, integer or numeric
    if _is_date(uniq_vals) or _is_dati(uniq_vals):
        return 'datetime64'

    try:
        _ = uniq_vals.astype("int")
        return 'integer'
    except:
        try:
            _ = pd.to_numeric(uniq_vals)
            return 'numeric'
        except:
            return "string"


def _leading_zero_exists(uniq_vals) -> bool:
    ''' Detect leading zeros
    Detects: 000123, 0123
    Not detects: 123, 0.123
    '''
    reg_lead_zero = "^0+[0-9]+(?!\.)"
    is_leading_zero = np.any([re.search(reg_lead_zero, str(val)) != None for val in uniq_vals])
    return is_leading_zero


def _can_parse_as_numeric(uniq_vals) -> bool:
    try:
        _ = pd.to_numeric(uniq_vals)
        return True
    except:
        return False


def _can_parse_as_integer(uniq_vals) -> bool:
    try:
        _ = uniq_vals.astype("int")
        return True
    except:
        return False


def _can_parse_as_datetime(uniq_vals) -> bool:
    try:
        _ = pd.to_datetime(uniq_vals)
        return True
    except:
        return False


def _is_date(x) -> bool:
    '''
    detect date format
    x: 1-d array or list of strings
    '''

    formats = ["%Y-%m-%d", "%Y/%m/%d",  # YMD
               "%d-%m-%Y", "%d/%m/%Y",  # DMY
               "%m-%d-%Y", "%m/%d/%Y",  # MDY
               "%m-%d", "%m/%d",  # MD
               "%d-%m", "%d/%m"]  # DM

    dttm = np.vectorize(datetime.datetime.strptime)

    date_detected = False
    for fmt in formats:
        try:
            dttm(x, fmt)
            date_detected = True
        except:
            continue

    return date_detected


def _is_dati(x) -> bool:
    '''
    detect datetime format
    x: 1-d array or list of strings
    '''

    formats = ["%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S",  # YMD HMS
               "%Y-%m-%dT%H:%M:%S", "%Y/%m/%dT%H:%M:%S",
               "%Y-%m-%d %H:%M:%S.%f", "%Y/%m/%d %H:%M:%S.%f",  # YMD HMS.f
               "%Y-%m-%dT%H:%M:%S.%f", "%Y/%m/%dT%H:%M:%S.%f",
               "%Y-%m-%d %H:%M", "%Y/%m/%d %H:%M",  # YMD HM
               "%Y-%m-%dT%H:%M", "%Y/%m/%dT%H:%M",

               "%d-%m-%Y %H:%M:%S", "%d/%m/%Y %H:%M:%S",  # DMY HMS
               "%d-%m-%YT%H:%M:%S", "%d/%m/%YT%H:%M:%S",
               "%d-%m-%Y %H:%M:%S.%f", "%d/%m/%Y %H:%M:%S.%f",  # DMY HMS.f
               "%d-%m-%YT%H:%M:%S.%f", "%d/%m/%YT%H:%M:%S.%f",
               "%d-%m-%Y %H:%M", "%d/%m/%Y %H:%M",  # DMY HM
               "%d-%m-%YT%H:%M", "%d/%m/%YT%H:%M",

               "%m-%d-%Y %H:%M:%S", "%m/%d/%Y %H:%M:%S",  # MDY HMS
               "%m-%d-%YT%H:%M:%S", "%m/%d/%YT%H:%M:%S",
               "%m-%d-%Y %H:%M:%S.%f", "%m/%d/%Y %H:%M:%S.%f",  # MDY HMS.f
               "%m-%d-%YT%H:%M:%S.%f", "%m/%d/%YT%H:%M:%S.%f",
               "%m-%d-%Y %H:%M", "%m/%d/%Y %H:%M",
               "%m-%d-%YT%H:%M", "%m/%d/%YT%H:%M"]

    dttm = np.vectorize(datetime.datetime.strptime)

    date_detected = False
    for fmt in formats:
        try:
            dttm(x, fmt)
            date_detected = True
        except:
            continue

    return date_detected


# =========================
# Utilities
# =========================

def rle(x):
    ''' Run Length Encoding (RLE)
    '''
    seq_index = np.concatenate(([True], x[1:] != x[:-1], [True])).nonzero()[0]
    vals = x[seq_index[:-1]]
    lens = np.ediff1d(seq_index)
    return vals, lens


def inverse_rle(vals, lens):
    ''' Inverse of RLE
    '''
    x = [None] * np.sum(lens)
    cnt = 0
    for i in range(len(vals)):
        for j in range(cnt, cnt + lens[i]):
            x[j] = vals[i]
        cnt += lens[i]
    x = np.array(x)
    return x


def guess_na_str(arr_dat) -> dict:
    ''' Guess NA strings included in the data
    '''

    dic_nas = dict(lst=None, exc=None, sts=None, str=None)

    # count occurrence of each item
    counter = Counter(arr_dat.flatten())

    # decreasing order
    idx = np.argsort(list(counter.values()))[::-1]
    sorted_freqs = np.array(list(counter.values()))[idx]
    sorted_items = np.array(list(counter.keys()))[idx]

    # remove items with nchars > 7
    nchars = np.array([len(x) for x in sorted_items])
    idx = np.where(nchars <= 7)[0]
    sorted_freqs = sorted_freqs[idx]
    sorted_items = sorted_items[idx]

    # remove non-na characters
    nas = [re.sub("([ ,;:]|\\[.*\\]|\\(.*\\)|[^\x01-\x7E])", "", x) for x in sorted_items]
    nas = [re.sub("( |\\d{1,2}/\\d|-?\\d*\\.?\\d+$)", "", x) for x in nas]
    nas = [re.sub("(^[a-z]+$|^[A-Z]{3,}$)", "", x) for x in nas]
    nas = [x for x in nas if x != ""]

    exceptions = ["Inf", "-Inf", "inf", "-inf", "#DIV/0!", "#VALUE!"]
    exc = np.intersect1d(nas, exceptions)
    sts = np.intersect1d(nas, np.setdiff1d(sorted_items, exc))

    dic_nas['lst'] = nas
    dic_nas['exc'] = exc
    dic_nas['sts'] = sts
    dic_nas['str'] = [sts[0]]
    return dic_nas


def guess_escape_strings(df) -> list:
    ''' Guess escape strings included in the data
    e.g. 99999, -99999 sometime indicates Inf, -Inf, respectively.
    '''
    escape_str = []
    for col in df.columns.values:
        escape_str.append(_extract_escape_str(df[col]))
    return escape_str


def _extract_escape_str(col) -> str:
    cnts = col.value_counts()
    vals_more_than_once = np.array(cnts.index[cnts > 1])
    if len(vals_more_than_once) == 0:
        return ""
    is_escape_str_detected = np.array([re.search("^(9+\\.?9*)$", str(val)) != None for val in vals_more_than_once])
    detected_str = vals_more_than_once[is_escape_str_detected]
    if len(detected_str) == 0:
        return ""
    else:
        return detected_str[0]
