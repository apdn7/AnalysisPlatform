
import os
import glob
import pyper
import time
import unicodedata
import base64
from contextlib import contextmanager


class CallR():
    # Class to use pyper.R
    # It is safe to set Sys.setenv(lang="en"), and set encoding="utf-8" when loading R file
    # Also it is necessary to define .libPaths() to './path/to/R-PORTABLE/library' to ensure that we load libraies from R-PORTABLE
    # (I think pyper goes wrong when multibyte string is printed)
    def __init__(self, r_exe=None, py_exe=None, use_reticulate=False, verbose=False):
        '''
        Start R session
        Inputs:
            r_exe (str) path to R executable (optional)
            verbose (bool) if True, prints R call
        Notes:
            Sys.setenv(lang="en") is to not print R message in multibyte string
        '''
        print('Start R.')
        self.verbose = verbose

        # start R with specified binary
        if r_exe is None:
            self.r_session = pyper.R()
        else:
            # start specified r executable and .libPaths()
            self.r_session = pyper.R(RCMD=r_exe)
            self.run_expr('.libPaths(c(""))')
            libpath = os.path.join(os.path.dirname(os.path.dirname(r_exe)), 'library')
            self.run_expr('.libPaths(c("{}"))'.format(libpath))

        self.run_expr('options(encoding = "utf-8")')
        self.run_expr('Sys.setenv(LANG="en")')
        self.run_expr('Sys.setlocale("LC_CTYPE", "ja_jpn")')

        # specify Python binary and load reticulate
        if use_reticulate:
            if py_exe is not None:
                self.run_expr('Sys.setenv(RETICULATE_PYTHON = "{}")'.format(py_exe))
            self.run_expr('library(reticulate)')

    def get_obj(self, obj: str):
        # get R object
        # obj (str) name of R object to get.
        obj = self.r_session.get(obj)
        return obj

    def load_rfile(self, fname: str):
        # load .R file
        # fname (str) file name to load. must be .R file.
        expr = 'source("' + fname + '", encoding = "utf-8")'
        self.run_expr(expr)
    
    def run_expr(self, expr: str):
        # run R expression
        # expr (str) R expression to run.
        #   - print() is to print R messages (default: True)
        #   - it is safe to replace escape to slash
        #   - wrap expr with e <- try() for error handling
        expr = expr.replace("\\", "/")
        expr = 'e <- try(' + expr + ', silent = FALSE)'
        print('running R. expr={}'.format(expr))
        if self.verbose:
            print(self.r_session(expr))
        else:
            self.r_session(expr)

        # store error messages
        self.r_session('if (class(e) == "try-error") e <- list(err = gsub("\n", "", e[1]), err_type="UnexpectedError")')
        self.r_session('if (!class(e) == "list") e <- list(err = NULL, err_type = NULL)')
        self.r_session('if (!"err" %in% names(e)) e <- list(err = NULL, err_type = NULL)')
        self.err = self.get_obj('e')


class RPipeline():
    """
    Class to sequentially load & call R functions.

    In each task, results are saved in pickle file,
    and file name is passed to the nekt task.

    * The reason why pickle file is used to pass data from R to Python,
      is that pyper is unstable to handle large data / multibyte data.
      To save data in pickle from R has about 1[sec] of overhead...
    """

    def __init__(self, dir_wrapr, dir_out=None, verbose=True, use_rds=False, use_pkl=True, use_r_portable=True):
        """
        Start R process

        Inputs:
            dir_wrapr  (str) Path to wrapr
            dir_out    (str) Where to save pickle file. Can be ignored.
                             If any fname_* is givien, file will be saved in the same directory.
                             If not, file will be saved in current directory.
            verbose   (bool) If True, R expression runs with print() + elapse time (python) is printed
            use_rds   (bool) If True, .rds file will be used if possible.
            use_pkl   (bool) If False, final result of executed function will be returned by pyper (not by pickle).
                             Use with care (passing complex / multibyte data by pyper may cause errors)
            use_r_portable (bool) If True, finds R.exe inside path/to/R-PORTABLE/bin .
                                  also finds python.exe inside path/to/R-PORTABLE/python/* .
                                  path/to/R-PORTABLE must be defined in environmental variable `R-PORTABLE`.
                                  If False (or R-PORTABLE is not defined), R and Python executable will be automatically searched.
        """
        # file name of wrapr and directory name is hard coded..
        FNAME_WRAPPER = 'wrapr.R'
        DIR_FUNC = 'func'
        self.dir_wrapr = dir_wrapr
        self.dir_func = DIR_FUNC
        self.dir_out = dir_out
        self.verbose = verbose
        self.use_rds = use_rds
        self.use_pkl = use_pkl
        self.use_r_portable = use_r_portable

        self.rportable_path = os.environ.get('R-PORTABLE')
        self.dir_log = '.' if self.rportable_path is None else os.path.join(self.rportable_path, '../log')
        self.dir_log = self.dir_log if os.path.exists(self.dir_log) else '.'
        self.ptime_sec = {}
        
        with self._timer('start R process'):
            # set R portable and python embeddable
            # set path to python binary as environmental variable 'RETICULATE_PYTHON' for reticulate.
            rpath = None
            pypath = None
            if self.rportable_path is not None:
                rpath = os.path.join(self.rportable_path, 'bin', 'R.exe')
                print('`R-PORTABLE` : {}'.format(self.rportable_path))
            if (self.use_pkl is True) and (self.rportable_path is not None):
                pypath = glob.glob('{}/python/python-*/python.exe'.format(self.rportable_path))[0]
                print('python binary : {}'.format(pypath))

            # start R process and load wrapper function
            self.r = CallR(rpath, pypath, self.use_pkl, self.verbose)
            fname_wrapper = os.path.join(self.dir_wrapr, FNAME_WRAPPER)
            self.r.load_rfile(fname_wrapper)

    def run(self, dic_data: dict, tasks: list) -> dict:
        """
        Run pipeline
        
        Inputs:
            dic_data (dict) Dictionary containing filenames of input data.
                            Keys: 'fname_x', 'fname_y', 'fname_newx'.
                            Can be ignored if a task does not need any input data.
            tasks    (list) List of dictionaries of each task

        Returns:
            dict

            If finished successfully:
                {
                    'fname_out': path to the results (pickle file),
                    'func': name of the function,
                    'ptime_sec': {dict containing process time of each step (load/transform/save data)},
                    'err': None
                }
            If error occur in R process:
                {
                    'err': error message
                }
        """
        
        print('Pipeline start: {}'.format([x['func'] for x in tasks]))
        self.dic_data = dic_data.copy()
        self.tasks = [x.copy() for x in tasks]
        self.res = []

        for (t, task) in enumerate(tasks):
            print('Task: {}'.format(task['func']))

            with self._timer(task['func']):
                with self._timer('{}: load source file'.format(task['func'])):
                    fname = os.path.basename(task['file'])
                    fpath = glob.glob('{}/{}/*/{}'.format(self.dir_wrapr, self.dir_func, fname))[0]
                    self.r.load_rfile(fpath)
                    if self.r.err['err'] is not None:
                        print('R ERROR: message={}'.format(self.r.err))
                        return(self.r.err)

                with self._timer('{}: run R expr'.format(task['func'])):
                    expr = self._gen_r_expr(t, task)
                    self.r.run_expr(expr)
                    if self.r.err['err'] is not None:
                        print('R ERROR: message={}'.format(self.r.err))
                        return(self.r.err)
                    res = self.r.get_obj('res')
                    res = self._decode_all_base64(res)
                    self.res.append(res)
        
        # return info of the last task
        return self.res[-1]

    def _gen_r_expr(self, t, task):
            # are we going to save results as .rds file?
            if self._check_rds_available(t):
                task.update({'type_out': 'rds'})
            
            # final results are saved in pickle?
            if self.use_pkl is False and (t + 1) is len(self.tasks):
                task.update({'type_out': 'list'})

            # create expression (e.g. res <- wrapr('fname_x=hoge1.tsv', 'fname_y=hoge2.tsv', ..., 'dir_out="."'))
            if t is 0:
                # first task takes tsv or no fnames    
                dic_inputs = self.dic_data.copy()
                dic_inputs.update(task)
            else:
                # from second task, use pickle file of previous task
                dic_inputs = {'fname_prev': self.res[-1]['fname_out']}
                dic_inputs.update(task)
            dic_inputs.update({'dir_out': self.dir_out})
            dic_inputs.update({'dir_log': self.dir_log})
            str_params = self._gen_param_string(dic_inputs.keys(), dic_inputs.values())
            expr = 'res <- wrapr({})'.format(str_params)
            return expr

    def _check_rds_available(self, t):
        # check that current task can save output as .rds file.
        # .rds is used to save results and pass to the next process,
        # If 
        # - self.use_rds is True
        # - current task is not the last one
        # - current task is R func and the next is R too
        res = False
        if self.use_rds is True and (t+1) < len(self.tasks):
            is_this_task_r = '.R' in self.tasks[t]['file']
            is_next_task_r = '.R' in self.tasks[t+1]['file']
            if is_this_task_r and is_next_task_r:
                res = True
        return res

    def _gen_param_string(self, keys, values):
        # generate single string which denotes parameters to pass to wrapr() function.
        # e.g. 'func=process2, 'dir_out=".", nhead=5'

        def _concat_param_without_quotes(k, v):
            # {k}=v: for numbers and functions
            return str(k) + '=' + str(v)

        def _concat_param_with_quotes(k, v):
            # {k}="{v}": for strings
            return str(k) + '=' + "'" + str(v) + "'"

        list_params = []
        for k, v in zip(keys, values):
            if v is not None:
                # generate paramter string
                if k == 'func' or type(v) is not str:
                    list_params.append(_concat_param_without_quotes(k, v))
                else:
                    # base64 encoding (if necessary)
                    v = self._enc_base64_if_multibyte(v)
                    list_params.append(_concat_param_with_quotes(k, v))

        str_params = ', '.join(list_params)
        return str_params

    def _enc_base64_if_multibyte(self, x):
        # encode with base64 if multibyte character is detected
        # x: str, int, float

        def _detect_multibyte_str(x):
            len_text = 0
            for c in x:
                j = unicodedata.east_asian_width(c)
                if j in 'FWA':
                    len_text += 2
                else:
                    len_text += 1

            if len_text > len(x):
                return True
            else:
                return False

        if _detect_multibyte_str(x):
            x_enc = base64.b64encode(str(x).encode('utf8'))
            x_enc = 'base64_' + str(x_enc.decode())
            print(x_enc)
            return x_enc
        else:
            return x

    def _decode_all_base64(self, obj):
        # decode base64 if 'base64_' is detected in character
        # obj: any python object
        
        def _dec_base64_if_multibyte(x):
            if isinstance(x, str):
                if 'base64_' in x:
                    x = x.replace('base64_', '')
                    x_dec = base64.b64decode(x).decode('utf8')
                    return x_dec
            return x
        for key, value in obj.items():        
            obj[key] = _dec_base64_if_multibyte(value)
        return obj

    @contextmanager
    def _timer(self, name):
        t0 = time.time()
        if self.verbose: 
            print('[{}] start'.format(name))
        yield
        ptime_sec = time.time() - t0
        self.ptime_sec[name] = ptime_sec
        if self.verbose:
            print('[{}] done in {:.2f} s'.format(name, ptime_sec))
