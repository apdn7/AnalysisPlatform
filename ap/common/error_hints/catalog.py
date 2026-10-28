"""Shared English message IDs and lazily translated error definitions."""

from dataclasses import dataclass

from flask_babel import lazy_gettext as _
from flask_babel.speaklater import LazyString


@dataclass(frozen=True)
class ErrorHintDefinition:
    """Display metadata; translation is deferred until the fields are rendered."""

    group: str | LazyString
    name: str | LazyString
    cause: str | LazyString
    hint: str | LazyString


ERROR_HINT_DEFINITIONS: dict[str, ErrorHintDefinition] = {
    '_default': ErrorHintDefinition(
        group=_('Other'),
        name=_('Unclassified Error'),
        cause=_('This exception is not registered'),
        hint=_('Check detailed logs'),
    ),
    'SyntaxError': ErrorHintDefinition(
        group=_('Syntax Error'),
        name=_('Syntax Error'),
        cause=_('The code contains invalid syntax'),
        hint=_('Check parentheses, colons, and quotation marks'),
    ),
    'IndentationError': ErrorHintDefinition(
        group=_('Syntax Error'),
        name=_('Indentation Error'),
        cause=_('The indentation is invalid'),
        hint=_('Check indentation level and spacing'),
    ),
    'TabError': ErrorHintDefinition(
        group=_('Syntax Error'),
        name=_('Tab Error'),
        cause=_('Tabs and spaces are mixed'),
        hint=_('Use a consistent indentation style'),
    ),
    'NameError': ErrorHintDefinition(
        group=_('Name and Variable Error'),
        name=_('Undefined Variable'),
        cause=_('A variable is referenced before definition'),
        hint=_('Check the variable name and definition'),
    ),
    'UnboundLocalError': ErrorHintDefinition(
        group=_('Name and Variable Error'),
        name=_('Uninitialized Local Variable'),
        cause=_('A local variable was referenced before assignment'),
        hint=_('Ensure the variable is assigned in all branches'),
    ),
    'TypeError': ErrorHintDefinition(
        group=_('Type Error'),
        name=_('Type Mismatch'),
        cause=_('An unexpected type was supplied'),
        hint=_('Check variable and argument types'),
    ),
    'ValueError': ErrorHintDefinition(
        group=_('Value Error'),
        name=_('Invalid Value'),
        cause=_('A value is outside the accepted range'),
        hint=_('Check input and configuration values'),
    ),
    'AttributeError': ErrorHintDefinition(
        group=_('Attribute Error'),
        name=_('Missing Attribute'),
        cause=_('The attribute or method does not exist'),
        hint=_('Verify the object type'),
    ),
    'IndexError': ErrorHintDefinition(
        group=_('Index and Key Error'),
        name=_('Index Out of Range'),
        cause=_('An invalid index was referenced'),
        hint=_('Check element count and index value'),
    ),
    'KeyError': ErrorHintDefinition(
        group=_('Index and Key Error'),
        name=_('Missing Key'),
        cause=_('The key or column does not exist'),
        hint=_('Check the key or column name'),
    ),
    'ZeroDivisionError': ErrorHintDefinition(
        group=_('Arithmetic Error'),
        name=_('Division by Zero'),
        cause=_('A division by zero was attempted'),
        hint=_('Ensure the divisor is not zero'),
    ),
    'OverflowError': ErrorHintDefinition(
        group=_('Arithmetic Error'),
        name=_('Overflow Error'),
        cause=_('A numeric overflow occurred'),
        hint=_('Check input values and data types'),
    ),
    'FileNotFoundError': ErrorHintDefinition(
        group=_('File and OS Error'),
        name=_('File Not Found'),
        cause=_('The specified file does not exist'),
        hint=_('Check filename, path, and working directory'),
    ),
    'PermissionError': ErrorHintDefinition(
        group=_('File and OS Error'),
        name=_('Permission Denied'),
        cause=_('Access to the file was denied'),
        hint=_('Check permissions and file usage'),
    ),
    'OSError': ErrorHintDefinition(
        group=_('File and OS Error'),
        name=_('OS Error'),
        cause=_('An operating system error occurred'),
        hint=_('Check the detailed error message'),
    ),
    'ImportError': ErrorHintDefinition(
        group=_('Module and Library Error'),
        name=_('Import Failed'),
        cause=_('Importing a module failed'),
        hint=_('Check libraries and import statements'),
    ),
    'ModuleNotFoundError': ErrorHintDefinition(
        group=_('Module and Library Error'),
        name=_('Module Not Found'),
        cause=_('The module could not be found'),
        hint=_('Check installation and environment'),
    ),
    'MemoryError': ErrorHintDefinition(
        group=_('Memory Error'),
        name=_('Out of Memory'),
        cause=_('Insufficient memory available'),
        hint=_('Reduce data size or memory usage'),
    ),
    'RuntimeError': ErrorHintDefinition(
        group=_('Runtime Error'),
        name=_('Runtime Failure'),
        cause=_('A runtime error occurred'),
        hint=_('Check detailed logs'),
    ),
    'RecursionError': ErrorHintDefinition(
        group=_('Runtime Error'),
        name=_('Maximum Recursion Depth Exceeded'),
        cause=_('Too many recursive calls were made'),
        hint=_('Check termination conditions'),
    ),
    'ConnectionError': ErrorHintDefinition(
        group=_('Communication and Network Error'),
        name=_('Connection Failed'),
        cause=_('A connection could not be established'),
        hint=_('Check network and destination'),
    ),
    'TimeoutError': ErrorHintDefinition(
        group=_('Communication and Network Error'),
        name=_('Timeout'),
        cause=_('Response time exceeded the limit'),
        hint=_('Check timeout settings and connectivity'),
    ),
    'UnicodeDecodeError': ErrorHintDefinition(
        group=_('Data Conversion Error'),
        name=_('Text Decoding Error'),
        cause=_('The file encoding does not match the reading encoding'),
        hint=_('Check utf-8, utf-8-sig, or cp932'),
    ),
    'UnicodeEncodeError': ErrorHintDefinition(
        group=_('Data Conversion Error'),
        name=_('Text Encoding Error'),
        cause=_('The output encoding cannot represent the text'),
        hint=_('Check output encoding settings'),
    ),
    'AssertionError': ErrorHintDefinition(
        group=_('Assertion Error'),
        name=_('Assertion Failed'),
        cause=_('An assertion condition was not satisfied'),
        hint=_('Check input data and assumptions'),
    ),
    'ParserError': ErrorHintDefinition(
        group=_('File Format Error'),
        name=_('CSV Parse Error'),
        cause=_('The CSV or TSV format is invalid'),
        hint=_('Check delimiter and header settings'),
    ),
    'EmptyDataError': ErrorHintDefinition(
        group=_('File Format Error'),
        name=_('Empty File'),
        cause=_('No readable data exists'),
        hint=_('Check file contents'),
    ),
}
