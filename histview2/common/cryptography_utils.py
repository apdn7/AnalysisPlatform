from cryptography.fernet import Fernet
from histview2.common.constants import DBType, ENCODING_UTF_8
import copy
from histview2 import dic_config


def generate_key():
    """
    Generate Fernet key for encrypting and decrypting
    :return:
    """
    return Fernet.generate_key()


def encode_db_secret_key():
    DB_SECRET_KEY = dic_config['DB_SECRET_KEY']
    return Fernet(str.encode(DB_SECRET_KEY))


def encrypt(plain_text):
    """
    Encoding a text with a key using Fernet.
    :param plain_text: str or bytes
    :return: cipher_text: bytes
    """
    if plain_text is None:
        return None

    cipher_suite = encode_db_secret_key()
    if type(plain_text) == bytes:
        plain_text_bytes = plain_text
    else:
        plain_text_bytes = str.encode(plain_text)
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
    if type(cipher_text) == bytes:
        cipher_text_bytes = cipher_text
    else:
        cipher_text_bytes = str.encode(cipher_text)

    plain_text = cipher_suite.decrypt(cipher_text_bytes)

    return plain_text.decode(ENCODING_UTF_8)


def encrypt_db_password(dict_db_config):
    """

    :param dict_db_config: db config dict: {db: {db-name: {key:value}}}
    :return: Hashed dict_db_config
    """
    dict_db_config_hashed = copy.deepcopy(dict_db_config)

    if dict_db_config_hashed.get('db'):
        for key in dict_db_config_hashed["db"]:
            db_config = dict_db_config_hashed["db"][key]
            if db_config and not db_config.get("hashed") \
                    and db_config.get("type") != DBType.SQLITE.value:
                plain_password = db_config.get("password")
                if plain_password:
                    hashed_password = encrypt(plain_password)
                    db_config["password"] = str(hashed_password, encoding="utf-8")
                    db_config["hashed"] = True

    return dict_db_config_hashed


def decrypt_db_password(dict_db_config):
    """

    :param dict_db_config: db config dict: {db: {db-name: {key:value}}}
    :return: Unhashed dict_db_config
    """
    dict_db_config_unhashed = copy.deepcopy(dict_db_config)

    if dict_db_config_unhashed and dict_db_config_unhashed.get('db'):
        for key in dict_db_config_unhashed["db"]:
            db_config = dict_db_config_unhashed["db"][key]
            if db_config and db_config.get("hashed"):
                hashed_password = db_config.get("password")
                plain_password = b""
                if hashed_password:
                    plain_password = decrypt(hashed_password)
                db_config["password"] = str(plain_password, encoding="utf-8")
                db_config["hashed"] = False

    return dict_db_config_unhashed
