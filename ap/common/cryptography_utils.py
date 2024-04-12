from cryptography.fernet import Fernet

from ap import dic_config
from ap.common.constants import DB_SECRET_KEY, ENCODING_UTF_8


def encode_db_secret_key():
    db_secret_key = dic_config[DB_SECRET_KEY]
    return Fernet(str.encode(db_secret_key))


def encrypt(plain_text):
    """
    Encoding a text with a key using Fernet.
    :param plain_text: str or bytes
    :return: cipher_text: bytes
    """
    if plain_text is None:
        return None

    cipher_suite = encode_db_secret_key()
    plain_text_bytes = plain_text if isinstance(plain_text, bytes) else str.encode(plain_text)
    cipher_text = cipher_suite.encrypt(plain_text_bytes)

    return cipher_text


def decrypt(cipher_text):
    """
    Decoding a text with a key using Fernet.
    :param cipher_text:
    :return: plain_text
    """
    cipher_suite = encode_db_secret_key()
    cipher_text_bytes = str.encode(cipher_text)
    plain_text = cipher_suite.decrypt(cipher_text_bytes)

    return plain_text


def decrypt_pwd(cipher_text):
    """
    Decoding a text with a key using Fernet.
    :param cipher_text: str or bytes
    :return: plain_text: str
    """
    if cipher_text is None:
        return None

    cipher_suite = encode_db_secret_key()
    cipher_text_bytes = cipher_text if isinstance(cipher_text, bytes) else str.encode(cipher_text)

    plain_text = cipher_suite.decrypt(cipher_text_bytes)

    return plain_text.decode(ENCODING_UTF_8)
