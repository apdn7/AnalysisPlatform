/**
 * Check Duplicated Data Source Name
 * @param {string} datasourceName
 * @param {number | null} datasourceId
 * @return {Promise<boolean>} - true: is duplicate, false: not duplicate
 */
const checkDuplicatedDataSourceNameFromDB = async (datasourceName = '', datasourceId = null) => {
    const data = {
        name: datasourceName,
        datasource_id: datasourceId,
    };
    const response = await fetchData('/ap/api/setting/check_duplicated_db_source', JSON.stringify(data), 'POST');
    return response.is_duplicated;
};

/**
 * Check Duplicated Process Name
 * @param {string} nameEn - Name English
 * @param {string} nameJp - Name Japanese
 * @param {string} nameLocal - Name Local
 * @param {number | null} processId
 * @return {Promise<boolean[3]>} - a list of boolean
 *    - true: is duplicate | false: not duplicate,  <--English-->
 *    - true: is duplicate | false: not duplicate,  <--Japanese-->
 *    - true: is duplicate | false: not duplicate,  <--Local-->
 */
const checkDuplicatedProcessNameFromDB = async (nameEn = '', nameJp = '', nameLocal = '', processId = null) => {
    const data = {
        name_en: nameEn,
        name_jp: nameJp,
        name_local: nameLocal,
        process_id: processId,
    };
    /** @type {{is_duplicated: boolean[3]}} */
    const response = await fetchData('/ap/api/setting/check_duplicated_process_name', JSON.stringify(data), 'POST');
    return response.is_duplicated;
};
