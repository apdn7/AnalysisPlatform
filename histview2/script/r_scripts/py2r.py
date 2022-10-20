import os
import time
import pyper
import csv
import pickle


r = pyper.R(use_dict=True)
r('source("./histview2/script/r_scripts/common.r")')

# data_size = ("1KB", "1MB", "100MB")
data_size = ("1MB",)
ip = "./instance/sample_data/42-4/in/"


# Calc processing time for `fn` function
def ext():
    def decorator(fn):
        def wrapper(*args, **kwargs):
            st = time.time()
            result = fn(*args, **kwargs)
            et = time.time() + 0.005
            exec_time = round((et - st) * 1000) # miliseconds
            print("Function `{:s}` executed in {:f} miliseconds!".format(fn.__name__, exec_time))
            return result
        return wrapper
    return decorator


# Write query data into tsv file
def write_tsv(data, ds):
    tsv_source = ip + ds + '.tsv'
    with open(tsv_source, 'wt', newline='') as f:
        writer = csv.writer(f, delimiter='\t')
        for row in data:
            writer.writerow(row)
    return tsv_source


# Write query data into pickle file
def write_pickle(data, ds):
    pkl_source = ip + ds + '.pkl'
    pickle.dump(data, open(pkl_source, "wb"))
    return pkl_source


@ext()
def p2r_pypy(data):
    r.data = data
    r.run("res <- py2py(data)")
    res = r.get('out')
    return res


@ext()
def p2r_pyt(data, ds):
    r.data = data
    r.ds = ds
    r.run("res <- pyper2tsv(data, ds)")
    tsv = r.get('res')
    with open(tsv, newline='') as f:
        reader = csv.reader(f, delimiter='\t')
        res = list(reader)
    return res


@ext()
def p2r_pypk(data, ds):
    r.data = data
    r.ds = ds
    r.run("res <- pyper2pkl(data, ds)")
    pkl = r.get('res')
    return pickle.load(open(pkl, 'rb'))


@ext()
def p2r_tpy(data, ds):
    r.tsv_source = write_tsv(data, ds)
    r.run("res <- tsv2pyper(tsv_source)")
    return r.get('res')


@ext()
def p2r_tt(data, ds):
    r.tsv_source = write_tsv(data, ds)
    r.ds = ds
    r.run("res <- tsv2tsv(tsv_source, ds)")
    ptsv = r.get('res')
    with open(ptsv, newline='') as f:
        reader = csv.reader(f, delimiter='\t')
        res = list(reader)
    return res


@ext()
def p2r_tpk(data, ds):
    r.tsv_source = write_tsv(data, ds)
    r.ds = ds
    r.run("res <- tsv2pkl(tsv_source, ds)")
    tpk = r.get('res')
    return pickle.load(open(tpk, 'rb'))


@ext()
def p2r_pkpy(data, ds):
    r.pkl_source = write_pickle(data, ds)
    r.run("res <- pkl2pyper(pkl_source)")
    pkl = r.get('res')
    return pkl


@ext()
def p2r_pkt(data, ds):
    r.pkl_source = write_pickle(data, ds)
    r.ds = ds
    r.run("res <- pkl2tsv(pkl_source, ds)")
    ptsv = r.get('res')
    with open(ptsv, newline='') as f:
        reader = csv.reader(f, delimiter='\t')
        res = list(reader)
    return res


@ext()
def p2r_pkpk(data, ds):
    r.pkl_source = write_pickle(data, ds)
    r.ds = ds
    r.run("res <- pkl2pkl(pkl_source, ds)")
    pkl = r.get('res')
    return pickle.load(open(pkl, 'rb'))


def main():
    # for ds in data_size:
    ds = "1KB"
    # Get data from csv/ database
    with open(ip + ds + ".csv", newline='') as f:
        reader = csv.reader(f)
        data = list(reader)

    p2r_pypy(data)
    p2r_pyt(data, ds)
    p2r_pypk(data, ds)

    p2r_tpy(data, ds)
    p2r_tt(data, ds)
    p2r_tpk(data, ds)

    p2r_pkpy(data, ds)
    p2r_pkt(data, ds)
    p2r_pkpk(data, ds)


main()