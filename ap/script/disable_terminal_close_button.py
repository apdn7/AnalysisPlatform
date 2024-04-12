def disable_terminal_close_btn():
    import win32console, win32gui, win32con

    try:
        hwnd = win32console.GetConsoleWindow()
        if hwnd:
            hmenu = win32gui.GetSystemMenu(hwnd, 0)
            if hmenu:
                win32gui.DeleteMenu(hmenu, win32con.SC_CLOSE, win32con.MF_BYCOMMAND)
    except Exception:
        pass


def close_terminal():
    import win32console, win32gui, win32con

    try:
        hwnd = win32console.GetConsoleWindow()
        if hwnd:
            win32gui.PostMessage(hwnd, win32con.WM_CLOSE, 0, 0)
    except Exception:
        pass
