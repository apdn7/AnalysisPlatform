# Releases

## v4.7.10

This version fixes the memory issue that occurred in version 4.7.9.

Improvements

- Improved performance of frontend, especially when large amount of Processes/Variables are configured

Bug fixes

- Resolved the memory issue that occurred in version 4.7.9
- Fixed an issue that occurred in Windows 11, where AP+DN7 may not activate appropriately due to a disk capacity check
- Fixed an issue in CHM, where "Start point" setting is initialized when loading a bookmark
- Fixed an issue in CHM, where variables with datatype: Int are processed as categories instead of numbers

## v4.7.9

New features

- (Config)
  - You can now initialize a process by clicking the "Initialize" button.  
  This function is used for example, change data types and re-import data.  
  <img src="https://github.com/user-attachments/assets/f4a41c92-6eb5-42bc-9fbd-799ff81d1f61" alt="479_InitializeProcess" width="600">
  - Spreadsheet-like editing is now available for filter config, display config and process config.  
  <img src="https://github.com/user-attachments/assets/847b7cf4-31e3-4938-a951-7a5f6e51fbbe" alt="479_SpreadsheetLikeEditor" width="600">
- (SkD)
  - Added a summary section to give summarized information and recommendations on how to proceed  
  <img src="https://github.com/user-attachments/assets/964905b2-70bd-445e-bae6-5152e27448b4" alt="479_SkDSummary" width="600">
  - Added "Strengthen selection" checkbox. This will re-draw SkD with strengthened (grid-searched) L1 penalty  
  <img src="https://github.com/user-attachments/assets/422b3409-9227-4784-a2df-85b3e1faa17d" alt="479_SkDStrengthenSelection" width="600">
- (Misc)
  - Added cookie banner / Cookie policy.
  - Added option `enable_ga_tracking` in startup.ini.  
  By setting this value to 0, you can force to NOT send telemetry data.  
  <img src="https://github.com/user-attachments/assets/107b1024-722e-4068-8c55-0c9d1f3b4e28" alt="479_EnableTrackingParam" width="600">
  - AP now stops the installation of Python embedded, Oracle portable and virtual environment when they exceed a certain amount of time
  - AP now checks for the amount of free disk space when starting the application.  
  AP will require that there is at least 10% of total disk space + 1GB of free space.

Improvements

- (Config)
  - Instead of directly using auto increment column,  
  AP now groups data using the auto increment column to safely import long format data.

Bug fixes

- (Config)
  - Fixed a bug where the data source could not be saved in certain case
  - Fixed an error message when CSV cannot be read with text encoding issue
  - Fixed a bug where graphs cannot be shown when a mix of Serial and Serial:Str are used
- (FPP)
  - Fixed a bug where bar charts in FPP incorrectly occupies multiple ticks
- (PCP)
  - Fixed a bug where axis ticks are not displayed correctly when only 1 and NA are present
- (AgP)
  - Fixed a bug where AgP fails to show percentage in some cases
- (Misc)
  - Fixed a bug where the Ctrl+Enter hotkey opens the sidebar search and shows graph at the same time

## v4.7.8

New features

- (Common)
  - Added a search box on the sidebar.
    - You can search pages with the three letter abbreviation (esample: FPP), English, or by configured language.  
    - Shortcut to move cursor to the searchbox: `Ctrl + /`
    - Also, you can press `Enter` to open the first page, `Ctrl + Enter` to open the first page in new tab.
    <img src="https://github.com/user-attachments/assets/4ae32c46-a643-4ac9-b790-8a5304404fdc" alt="SerchboxOnSidebar" width="600">
- (Config)
  - Added backup/restore functionality
    - You can save backup of configurations and transaction data  
    <img src="https://github.com/user-attachments/assets/ef42d347-3a80-4cd3-a90a-addc84043250" alt="BackupRestore" width="600">
  - Data Source Config: Added Python ETL capability.  
    - For data that need customized preprocessing, you can use a Python script to perform ETL.
    - This functionality is currently only available for CSV/TSV.
    - Template file: `\ap\script\user_scripts\py\template.py`
    - .py files placed on the `\ap\script\user_scripts\py` will be listed up.
    <img src="https://github.com/user-attachments/assets/0a11bf8f-f002-41b2-87b4-45c953016d05" alt="PythonETL" width="600">
  - Data Link Config: Now shows a preview for data link  
    - <img src="https://github.com/user-attachments/assets/ac463d16-bbd9-4bfc-a24e-88391c508d24" alt="PreviewDataLink" width="600">
  - Function: Added "main::Serial" checkbox.  
    - Now we can use variables defined in Function in process settings for data link.

Improvements

- (Common)
  - Updated some python packages (for example, pandas)
  - Improved to redirect to the bookmarked page, after the terms of use is shown.
  - Added "New Tab" to the context menu displayed by right-clicking on the "Open" button in Bookmark page
  - Graph setting area: Improved performance of the rendering process for large number of variables
  - Graph settin area: Now we can switch the width of the system name shown
    - <img src="https://github.com/user-attachments/assets/a7eb6c95-7f4b-4cf9-a7e2-94b53ec9a3a9" alt="ChangeWidthOfSensorNames" width="600">  
- (Config)
  - Now confirmation modal is displayed when there are unsaved changes on each config page
  - Data Source Config: Improved to show raw data for the preview
  - Process Config: Improved detection of data types for serial columns
  - Process Config: Datetime data with commas will be formatted to dots when previewing date and time data
  - Process Config: Only detect units those in DN7, when extracting units inside [ ] of column names.
  - Process Config: ncreased the number of data source names displayed in the data source dropdown from 10 to 30.
  - Process Config: Apply both Japanese and local names for reserved column name for certain data types
  - The config page can now be hidden only when accessed via an IP address
    - Change `hide-setting-page` parameter in the configuration file (`.\AnalysisPlatform478_7770\ap\config\basic_config.yml`) to `true`
- (PCP)
  - Improved to enable cycle time analysis when selecting a date and time variable and jumping to PCP
- (AgP)
  - For data export: "Filtered data", now aggregated (calculated) data is exported.
- (SkD/GrL)
  - Added auto-update functionality
- (Misc)
  - External API: Added /fpp, /pcp, /skd, /rlp, /chm, /msp, and added parameters to the Register from File API
  - Now AgP and RLP can jumped from all other pages
  - Improved to allow the target datetime range to be properly pasted into the target datetime values  
  for Divide by category, Divide by term(Cyclic) and Divide by term(Direct) when copying settings to RLP or StP.
  - Now allowstable type value ('measurement' or 'history') of Software Workshop ETL

Bug fix

- (Config)
  - Process Config: Fixed an issue where column names containing full-width alphabetic characters could not be imported
  - Process Config: Fixed a bug where column data types were not pasted correctly when using copy and paste function
  - Process Config: Fixed a bug where new records could not be imported after setting a function
  - Process Config: Fixed an issue where GeneratedDatetime could not be generated using the Main::Date and Main::Time columns if their names were duplicated
  - Process Config: Fixed an issue where FileName could not be imported in Process Merge mode
  - Data Link Config: Fixed a bug where nodes were not properly positioned
  - Filter Config: Fixed a bug where descriptions were not displayed when moving the mouse over column title
- (FPP)
  - Fixed a bug where datetime values ​​were displayed in UTC time zone in label plots
- (RLP)
  - Fixed a bug where NG rates could not be calculated when "No data link" was selected
  - Fixed a bug where NG rate data points were not vertically aligned with ridge line plots
  - Fixed a bug where EMD could not be displayed correctly when invalid data was at the beginning
- (Misc)
  - Fixed a bug where Pulse in cleansing on the graph display page was incorrectly applied to category data
  - Fixed a bug where data from V2 csv files could not be read
  - Fixed a bug where historical data from V2 csv files could not be previewed due to normalization of process name strings
  - Fixed a bug in importing data from Software Workshop ETL

## v4.7.7

Improvements

- Now uses can sort columns by variable name on dropdown lists of setting area in visualization pages
- Added No Data Link option in Full-points Plot (FPP)
- Ridgeline Plot (RLP) now defaults to auto range for minimum and maximum axis value if either are set in Display Config
- Datetime format now works against datetime values with 6 floating digits
 
Bug fix

- Fixed some issues when using "Function" columns for On-demand filter
- Fixed an issue where value of "NG Condition" is not loaded properly from Bookmark on RLP

## v4.7.6

Bug fix

- Fixed a bug where some data periods were not imported from a database
- Fixed a bug where data preview did not appear in Process Config page from a database which has a date column
- Fixed a bug where data importing failes when CSV/TSV file has an empty column name
- Fixed a bug of significant digits on the Y axis of the graph in Full-points Plot (FPP)
- Fixed a bug where some data periods to not be imported from the Software Workshop interface (PostgreSQL)


## v4.7.5

New features and improvements

- (Common)
  - Improved overall performance of AP+DN7
  - Enable "Filter" checkbox of Display variable setting to all visualization tools
- (PCP)
  - Enabled Auto-update
  - Improved computation time
- (AgP)
  - Enabled Y-axis options
- (ScP)
  - Now shows in 1:1 aspect ratio like HmP
- (Config)
  - Config Page: Added search box to Dropdown lists on Data Source Config and Process Config
  - Data Source Config / Process Config: Now show raw data for datetime
  - Data Source Config: Now automatically preview data after path is given
  - Data Source Config: A more detailed warning message is now shown when a data file cannot be previewed
  - Process Config: Data type of columns with values all 0 or all 1 is now estimated as an integer
  - Process Config: Added an example of datetime format on hover message
  - Process Config: Filename is unchecked by default
  - Merge Mode: Improved visibility of sample data
  - Function: Improved visibility. You can now click expansion button of Function to automatically scroll down
  - Function: Search box in "New function" modal now has an 'x' (close) button to clear input
  - Register by file: Now assigns the file name instead of folder name as process name by default

Bug fix

- (FPP)
  - Fixed a bug of rounding up the tick values of the Y axis incorrectly
- (PCP)
  - Fixed a bug where Categorical-only mode can not be visualized
  - Fixed a bug where highlighting fails when the data does not have fully linked
  - Fixed a bug where incorrect graph range is applied after Display Config
- (HMp)
  - Fixed a bug where unable to show graph with Category and String as input
- (Config)
  - Data Link: Fixed a bug where autolink cannot be executed for `DatetimeGenerated` column
  - Data Import: Fixed a bug where files cannot be read with unicode_escape
  - Register by File: Fixed a bug where automatically fills Japanese instead of Local name in English language mode
  - Fixed a bug where some input fields (comment, datetime format, etc) are not reset upon closing modals
- (Misc)
  - Fixed a bug where console window does not close automatically when shutting down AP+DN7 

## v4.7.4

New features and improvements

- (Config)
  - Now automatically remove spaces at the beginning and end of the file/folder path given in Data Source Config and "Register by File" page
  - Fixed the name of "Data Source Type" options in Data Source Config
  - Improved to allow "Function" to be set at the same time as data import settings in Process Config
  - Fixed the description of the "extract.reg(X, s, t)" function in the regular expression string extraction of "Function"
  - Fixed the description of "Link with time" and "Cut off" that are displayed on the hover when linking datetime on Data Link Config
  - Changed to display the objective variable at the top when jumping from a page with an objective variable to a page without an objective variable using the jump function
  - Improved to allow the display order of processes to be rearranged in the dropdown for selecting processes on the visualization/analysis page  
  <img src="https://github.com/user-attachments/assets/f1be6473-7d17-4572-b3b6-ba6213605e51" alt="SortProcess" width="600">
  - Added a "Tooltips" button to toggle the display/hide of the hover that can be displayed from the graph  
  <img src="https://github.com/user-attachments/assets/244d0aab-8305-4b3f-8bbf-904aa0020e81" alt="SortProcess" width="600">
- (PCP)
  - Added an on/off toggle button for "Data View" to display details of the latest 20 records of the highlighted data  
  <img src="https://github.com/user-attachments/assets/90a6453d-3549-4bcd-a748-8aa17b7337e9" alt="SortProcess" width="600">
  - The scale of the color bar now automatically adjusts to the data type. (For example, when the data type is "Judge" or "Boolean", only two scale values ​​are displayed)
- (PCA)
  - Improved to allow seperate filters to training data and target data
    - For example, you can now train with only good product data and infer good/defective product data as target data
  - Added jump button
- (AgP)
  - Changed to display OK in blue and NG in red for variables set to Judge data type
- (SkD)
  - Removed unnecessary white space in the bar graph on the right side of the graph area
  - Improved the number of significant digits of the contribution value displayed on hover
- (HMp)
  - Added "Filter" checkbox to the dropdown for selecting variables
  - Improved to make the aspect ratio of graphs

Bug fix 

- (Config)
  - Fixed a bug where the target data source was not deleted from the list when the data source was deleted in Data Source Config
  - Fixed a bug where suffixes for system names and Japanese/local names were not automatically generated when there were duplicate column names regardless of whether they contained full-width/half-width characters in Process Config
  - Fixed a bug where the "interval(X, a, b)" in "Function" did not work for datetime generated from date(main::Date) and time(main::Time) in Process Config
  - Fixed a bug where the estimated process order was sometimes displayed incorrectly in the "Auto link" function in Data Link Config
  - Fixed a bug where background jobs in the app were sometimes deleted when a new process was registered
- (MSP)
  - Fixed a bug where "Process name" was displayed instead of "Variable name|Process name" when seven or more variables were selected
- (ScP)
  - Fixed a bug where the color bar was not displayed when the X-Y axis was swapped
  - Fixed a bug where the color bar displayed incorrect scales when displaying a graph using time sorting and time progression

## v4.7.3

New features and Improvements

* (Common)
  * On-demand filter can now be applied when using `Jump` Function  
  <img src="https://github.com/user-attachments/assets/4e441d6d-3d30-4b0b-b658-0d0dd8afac67" alt="JumpODF" width="600">
  * Visualization pages now opens with no bookmark loaded by default
  * Improved auto-scrolling after showing graph and scrolling buttons
  * When copying settings between pages, the time Window Length and Interval are now adjusted to keep the time period the same
  * Datetime can now be selected on Display Config page
  * Datetime can now be calculated as CT for PCP, SkD, PCA, GL pages
  * Copying User setting now copies the Outlier cleansing settings as well
  * Copying User setting from Stratified Plot to Ridgeline Plot now keeps the target period settings
  * X and Y axis can now be changed in ScatterPlot and HeatMap pages
* (FPP)
  * Parallel Coordinate Plot now uses Auto Range by default
  * All columns in the dataframe can now be selected for X-axis ordering
  * The hover popup no longer go out of the browser's viewport
* (PCP)
  * Enabled Y-axis scaling (Full range, Graph config, etc)
  * The latest 20 srecords within the selected data are now displayed in a table  
  <img src="https://github.com/user-attachments/assets/f442d950-0da4-46d3-90ca-c6c536c9a983" alt="PCPDataPreview" width="600">
* (SkD)
  * The hover message in SkD now shows the positive/negative relationship between variables
* (AgP)
  * AgP is now able to use a common scale for histogram and line charts respectively
* (HMp)
  * X and Y values are now shown on hovers in HeatMap page
* (Config)
  * New data types can now be used in Process Configuration: `Judge` and `Boolean`
  * `Merge mode` can now be used for databases
  * Sample Data in `Function` configuration can now be copied into a spreadsheet
  * Backup-Restore: Imported data can now be backed up and restored within a specified time period
  * Process Configuration for registered processes can now be viewed without connecting to the datasource
  * Process Configuration can now be downloaded instead of copying to clipboard when APDN7 is accessed through an IP address  
  <img src="https://github.com/user-attachments/assets/b1c2fdf8-24f8-41c5-99be-eddceff8b9ec" alt="downloadconfig" width="600">
  * Sample data in Function Configuration page now shows the top 50 results by unique X-Y pairs
  * Merge function now works better with mixed datatypes between X and Y
  * Process Configuration modal now has explanation for some data types
  * Register By File now jumps to FPP instead of CHM after importing is finished if dummy_datetime is present
  * Optimized the speed for data link using datetime-cutoff
  * Improved responsive styling of the Function Configuration modal
  * Filter name in Filter Configuration page is now auto-filled when selecting a column
  * Master filters are not automatically selected as filters and labels in Show graph pages. PartName, PartNo, LineName, LineNo are selected for the first process only.
  * Datasource preview now shows rows with NA values
  * In Function Configuration modal, function sample data rows are not sorted in X -> Y -> Result priority, and NA values are at the bottom
  * Function Configuration now shows both local and system names for columns in the input selection
* (Misc)
  * Now `Register by File` page supports V2 CSV files
  * Support new data source: Software workshop databases
  * The Jump Function modal can now be filtered, and has Auto Select, Select all checkboxes
 
Bug fixes

* (Common)
  * Fixed an issue where a column is not moved to the top of the list when selected as Facet or Div in Show graph pages
* (FPP)
  * Fixed an issue where outlier points do not lie at the edge of FPP charts
* (PCP)
  * Fixed a bug where categories are wrongly sorted
  * Fixed an issue where the "Move next to target variable" button in Parallel Coordinate Plot fails to work
  * Fixed a display bug where NA and Infinite values have the wrong color in Parallel Coordinate Plot
* (SkD)
  * Fixed an issue where SankeyDiagram fails to show binary classification mode when there are NA values in the data
* (RLP)
  * Fixed an issue where the Graph settings option does not work correctly for RLP
* (Config)
  * Data sources and processes created through Register By File page can now be previewed
  * Autolink fails due to lack of delta_time and cut_off fields
  * Fixed a bug where Auto Select does not work properly in Process Config modal
  * Fixed a bug where Merge Mode returns an error when merging Float data into an Integer column
  * Fixed an issue where datetime format is not applied after changing the datatype of a column in Process Config modal
  * Fixed an issue where job status is not shown in Process Config page
  * Fixed a bug where confirmation modal appears even when no changes are made to a function
  * Fixed a display bug where long column names cause text to overflow in Function Config
  * Fixed an issue where a failed validation remains even after changing function
  * Fixed an issue where X and Y cannot be selected after selecting me.type.convert(t)
  * Fixed a bug where filling a process name in Process Config screen does not fill the process name field in the Process Config Modal
  * Fixed an issue where duplicate column names are not automatically parsed in Process Config page and data import fails against duplicate column names with "_" character
  * Fixed a problem where preview of database leads to an error if database has boolean data
* (HMp)
  * Fixed an issue in HeatMap page where a wrong message is shown when showing graph
  * Fixed an issue where HeatMap page shows a wrong color scale for binary and integer cases
* (Misc)
  * Fixed a bug where using Jump Function alters the copied setting
  * Fixed an issue where child processes appear in Table Viewer and Filter pages
  * Fixed a display bug where milliseconds are displayed for time data in HeatMap and ScatterPlot pages
* (ScP)
  * Fixed an issue where ScatterPlot shows a wrong color scale when Integer is selected as Color

## v4.7.1

Improvements

- Improved layout of `Function` setting in Process Config

Bugfixes

- (Data Source Config)
  - Fixed a bug where data import does not execute after updating CSV/TSV Import Config.
- (Process Config)
  - Fixed a bug where `Function`s those convert data to logical value (e.g. logical X==s, Hex to Logical) could not be defined.
  - Fixed a bug where Sample Data for the function setting was not displayed.
- (Misc)
  - Fixed a bug where the console screen does not close automatically when launching AP+DN7.
  - Fixed a bug where data from a CSV file could not be displayed on Table Viewer.

## v4.7.0

Now you can install/upgrade AP+DN7 with installer (batch file).  
See documentation "Getting Started" for more details.  

Core changes

- Added "Function" to Process Config, allowing users to apply preprocessing to imported data.
  - Users can specify transformation functions applied to imported data. 
  - Currntly, functions can be specified after data import. 
  <img src="https://github.com/apdn7/AnalysisPlatform/assets/106378158/17cec83a-f7c6-4662-9f2b-fafd84d239e2" alt="Function" width="600">      
  <img src="https://github.com/apdn7/AnalysisPlatform/assets/106378158/7b5c07a4-b860-4dee-9470-a91e4d9cb7b6" alt="FunctionRegex" width="600">  
  (An example of extracting machine number from machine name)
  - Additionally, specifying number of rows to read / transposing the data / importing file name as a column is supported.  
  <img src="https://github.com/apdn7/AnalysisPlatform/assets/106378158/de31e416-102d-4df6-ad61-d6f2f4f0c5b9" alt="nRowsTranspose" width="600">  
  <img src="https://github.com/apdn7/AnalysisPlatform/assets/106378158/6e55126f-43ae-416e-947c-2d1e51b9e9d0" alt="JumpPageSelectVariables" width="600">

New features

- (Process Config)
  - Support Date and Time on seperate columns. Those are merged to from Datetime column.  
  <img src="https://github.com/apdn7/AnalysisPlatform/assets/106378158/e5e8909c-74f7-433a-93f1-80c75735546f" alt="DateandTime" width="600">
  - Added link with time: Now Datetime columns can be used for linking the data.   
  <img src="https://github.com/apdn7/AnalysisPlatform/assets/106378158/f2d9a084-e06d-49a0-b2ed-d58fe803653e" alt="LinkWithTime" width="600">
- (Jump function)
  - Now user can select additional variables / select objective variable before jumping to new page.  
  <img src="https://github.com/apdn7/AnalysisPlatform/assets/106378158/a503bc1c-e874-427b-a847-6960307e731e" alt="JumpPageSelectVariables" width="600">

Improvements

- (Common)
  - Variables with data type: `Serial` can now be used as a facet variable.
  - Improved title of the confirmation modal.
- (AgP)
  - Now shows line chart for data type: `Integer` and bar chart for `Integer (Category)`.
  - Now calculates / displays percentage per facet.
- (Register by File)
  - Now removes double quotes (") from file paths pasted to textbox.
- (Display Config)
  - When using fill handle of the Spreadsheet editing mode, now copies values instead of incrementing them.
- (API)
  - Added `POST /bookmark` API. This API saves a bookmark based on parameters from /dn7 and /options.
  - Added parameters `facet` and `filter` to `POST /dn7` API.
    - `POST /dn7` now can be used for AgP, ScP, StP.
- (Backend)
  - Improved logic for skipping lines when reading CSV/TSV/SSV.
 
Bugfixes

- (AgP)
  - Fixed an issue where ticks and their significant digits are shown incorrectly.
- (CHM)
  - Fixed an issue that tooltip on the chart displayed the wrong date, on the last day of a month.
- (SkD)
  - Fixed a case where error occurs when objective variable is binary variable and number of data point is large.
- (Process Config)
  - Fixed an issue where data is displayed wrongly when there are columns with empty names in CSV files.
- (Filter Config)
  - Fixed an issue where filter values are not shown when there are NA values in the column.
- (Bookmark)
  - Fixed a case where time period is loaded incorrectly.
- (Backend)
  - Fixeda an issue where multiple browser tabs are opened when starting the application.
  - Fixed an issue where hexademical data parsed incorrectly.
  - Fixed a bug where APDN7 is unable to start after its containing folder (and virtual environment) has been moved to another directory.
  - Fixed a bug where APDN7 is unable to start in PC which has Conda installed.
  - Fixed a bug where Japanese column and process names are parsed into romaji incorrectly.
  - Fixed an issue where the application's process pool is terminated abruptly when a job fails.

## v4.6.2

Hotfix

* Fixed an issue that data preview does not appear on data source config, when importing from database
* Improved data type estimation to correctly estimate Real type data with `Null` values

## v4.6.1

New features

* Added `Register by File` page
  * Now users can import CSV/TSV/SSV data more easily.
  * By providing folder path or file path, data source config and process config are registered with the default setting,  
  and CHM is automatically visualized after the first data file is imported.  
  <img src="https://github.com/apdn7/AnalysisPlatform/assets/106378158/640d9476-ca63-42dc-99c7-df8672429827" alt="registerbyfile" width="300">

Improvements

* Updated English texts
* Improved log handler
* Improved to show the `Terms of Use` in each version.
* (JA) Change text of Data-type selection from Japanese to short type of English
  * (整数 -> Int, 文字列 -> Str, 実数 -> Real, 日時 -> Datetime)

Bugfixes

* Fixed an issue of visualizing COG page
* Fixed an issue that Jump modal is not shown in RLP page.
* Fixed a bug related to data import. AP+DN7 wikk import data of get_date column including NaN value.

## v4.6.0

New features

* Added Loading and Initiating Error pages when start application
  * After the activation of the AP+DN7, screen will automatically change  
  <img src="https://github.com/apdn7/AnalysisPlatform/assets/106378158/b0232c8f-685b-4f86-8ac8-a33e976919e1" alt="startscreen" width="300"> 
* Added Job Error page to show all failed jobs and detail information
  * Now it is easier to find the details of job errors  
  <img src="https://github.com/apdn7/AnalysisPlatform/assets/106378158/759b39ed-d366-46dc-b93f-6735ddf347db" alt="failed jobs" width="300"> 
* Added a feature to verify the linking process between start-process and target-process
  * Warning is displayed in case when no data links.  
  <img src="https://github.com/apdn7/AnalysisPlatform/assets/106378158/a8205057-b9a0-41c5-9f60-0a17cbb5a93b" alt="warn no links" width="500"> 
* Modified GUI for Process config page.
  * Added some column types: `main::Datetime`, `main::Serial` and other system types
  * Added `Seri` data-type to show in process's target column  
  <img src="https://github.com/apdn7/AnalysisPlatform/assets/106378158/cfbe874f-9b6e-47ad-b1b9-f3ffd15a9e1a" alt="modify process config" width="500">
* Added Ordinalize categorical values in SkD page
  * This function enables to extract relations between categorical variables and numerical objective variable.  
  <img src="https://github.com/apdn7/AnalysisPlatform/assets/106378158/1ba0e0ed-5afe-409b-bf9b-16b27785f8ef" alt="ordinalize" width="300">
* Added `Fine Select` feature to PCP to select range of value in dimension columns  
  * Now it is easier to filter the shown data in detail  
  <img src="https://github.com/apdn7/AnalysisPlatform/assets/106378158/de93631b-b916-4a1e-9777-c32f2ebd9713" alt="fine select" width="600"> 
* Added color to `threshold` (red), `Process threshold` (light-blue) setting in Threshold/Graph Config page  
  * Now users can notice the correspondence between the settings and the line colors  
  <img src="https://github.com/apdn7/AnalysisPlatform/assets/106378158/6edc873b-d468-4e31-ac9f-c69e0cdde6df" alt="color to threshold config" width="500">
* Added external API

Improvements

* (Common)
  * Verify the app files by `path_list` information.
  * Modified Japanese texts
  * Removed unused message from `.po` files
  * Show total of selected variables
  * Launch the app in virtual environment (Python)
  * Modified `Data-Finder` to start from Monday
  * Order graphs by variable selection order (click event)
* (Config)
  * Now AP+DN7 generates columns name for non-header datasets (with `skip` setting in datasource config)
  * Verified duplicated process name in System Name, Japanese Name and Local Name
  * Changed camelCase to PascalCase and apply ASCII normalization in System Name/Local Name of Process config
  * Removed `minimize` and `maximize` from context-menu in config pages
  * Adjust text-size of bookmark modal
  * Hide `DummyDatetime` if uncheck this column from Process Config page
  * Support some kinds of datetime format (`MM月DD日, MM-DD, MM/DD, dd/mm/yy, ...`)
  * Support V2 with horizontal columns: `Work Type, Quality, Lot No, Tray No`
  * Now we can import V2 dataset with duplicated columns
  * Now we can import V2 dataset without `process_name`
  * Improved Filter Config page
  * Improved performance of Job List page
  * Detect EU format of number
  * Support `SSV` dataset in COG page and data-importing
  * Show encoding of dataset in Data-source config page
  * Enhance the coefficient with K-Sep pattern
  * Support showing data preview and import `all NA` column, as string
* (FPP)
  * Cast Int Category column and show them with Step-bar chart
* (PCP)
  * Improved ordering for category variables
  * Changed default chart type in PCP by data types and target variables
* (ScP)
  * Show ticks on violin chart
  * Change default color scale of ScP to `Auto Scale`
* (AGP)
  * Apply graph limitation
* (CHM)
  * Improved performance
* (SkD/CHM)
  * Aded `filter` checkbox
* (SkD/RLP/PCA/GL)
  * Hide checkbox and radio button of `Seri` variable
* (RLP)
  * Support `Jump with EMD and NG rate (Judge)`
* (Internal logics)
  * Improved `detect_abnormal_count` by random seed
  * Improved performance of `sigificant_digit` by using `mode.use_inf_as_na` (pandas) instead of replace `inf` to `NA`
  * Support launch the application by Direct Startup Mode
  * Change packages downloading script use powershell instead of `CURL`
  * Manage announcement event by multiple processing
  * Now run the app by multiple processing
  * Enhanced the data importing from the factory datasource to include one month's data at least (in past)
  * Updated the init data with new process setting (`init/app.sqlite3`)
  * Upgraded `gtag.js`
  * Removed UA tracking
  * Change the way to calculate cycle time
  * Changed the `labelencode (labelencode_by_stat)` from median to mean as default, to be more sensitive to detect relations
  * Restructured transaction database by process to improve performance
  * Split `scheduler` to another database from `app.slite3`
  * Upgraded flask-framework version to version `2.0.0`

Bug fixes

* (Common)
  * Fix a bug for the APDN7 console to close after clicking the Shutdown button.
  * Fix issue of checking selected column by `Set` button 
  * Fixed a bug where locale does not change arcording to configuration in `startup.ini`
  * Do not let the app auto-restart while error has occurred
  * Change condition filter in GUI
  * Fix the app to avoid connect database many times 
  * Fix issue of database lock
* (Config)
  * Registering English column name and same-mean column name in the V2 datasource.
  * Fix a bug for showing wrong name issue of column in Proc-link graph (config page)
  * Validate valid files/folder in Datasource Config page
  * Fix issue of `auto link` processes
  * Do not normalize input path to `hankaku` characters
  * Fix issue of coef with negative matching by regex
* (FPP)
  * Fix y-ticks for CT
  * Inconsistent cross-hair showing at timeseries and histogram charts in FPP page
  * Fix `N Total` in summary box in case of facet selection in FPP page
* (SkD)
  * Data-ordering in SkD page
* (StP)
  * Fix a bug StP could not show graph in `latest` mode
* (MSP)
  * Fix a bug for showing graph slowly in MSP
* (PCP)
  * Fixed chart showing with scrollbar
* (ScP)
  * Fix scale range for color in ScP page
* AgP
  * Fixed an issue of exporting data from AgP
* (Internal logics)
  * The import-data job is terminated by the ProcessPoolExecutor (`max_workers`=5).
  * Fix a bug related to missing columns (`Key-Error`) and encoding while importing data
  * Fixed to get time-range of factory-data incase of SQLite datasource
  * Tracking import history as transaction data
  * Bincount in discretize data feature does not accept minus numbers
  * Fix a bug of failure to download python relevant to authentication by `CA_CERT`
  * Fix bugs of factory data importing in `FACTORY_PAST_IMPORT` logic
  * Fix issue of re-schedule job
  * Fix duplicated records from factory data
  * Fix issue of data-importing by `UnicodeDecodeError`
  * Fix issue of `unknown idna` when retrieve hostname
  * Adjust datetime in timezone with Summer time

## v4.5.2

This version includes below bufixes:

* (Important) Fixed an issue where graph display was completely disabled (From Feb.5, 2024) in AP+DN7 version >=4.2.0
* Fixed an issue where historical data older than one month was not being loaded from the database
* Fixed an issue where AP+DN7 can not display graph after `Process Name` is edited
* Fixed an issue about the limit of number of variables that can be selected in each visualization
* Fixed an issue about data count when a column `process_id` exists in data source

Please follow the instructions in the following manual to upgrade AP+DN7.

* EN: [Upgrade Manual](https://github.com/apdn7/AnalysisPlatform/files/12557931/AP%2BDN7_upgrade_manual_En_v4.1.1_r2.pdf)
* JP: [Upgrade Manual](https://github.com/apdn7/AnalysisPlatform/files/12557930/AP%2BDN7_upgrade_manual_Jp_v4.1.1_r2.pdf)

Improvements

* Common
  * Implemented `Jump` function to all visualizations except PCA and COG
    * Users can now experiment with various visualizations more easily than before  
    <img src="https://github.com/apdn7/AnalysisPlatform/assets/106378158/59cfc500-2d2d-41c7-9718-cb8ac8aea035" alt="JumpFunction" width="700"> 

## v4.5.1

This version is a minor update including some bug fixes

Improvements

* Common
  * Support new format of datetime: 'dd/mm/YYYY'
  * Detect serial column and auto-check in Process Config page

* V2 data
  * Enable importing 'WorkType, Quality, LotNo, TrayNo'
  * Enable importing alphabetical column names
  * Extract vertical data without measurement label in value: '計測値:|measurement.'
  * Support to detect process name if there is no value
  * Enable selecting/importing duplicated column names

Bug fixes

* Common
  * Fixed to appropriately modify English Name of Process Config page
  * Fixed an issue when importing same column name from CSV data
  * Fixed an issue of AgP page about summarized data using tz_convert for datetime
* V2 data
  * Fixed to import abnormal columns
  * Fixed issue of 'undefined' value when preview data from Process Config page

## v4.5.0

Core changes

* Upgraded from python 3.7.3 to python 3.9.0
  * Now the folder name of the downloaded Windows embeddable package for Python will be  `python_embedded_39`.
* Hided 'x' button on the console screen, to prevent closing the console screen by mistake.
  * User can only shutdown the APDN7 by accessing the APDN7 with `localhost:{port_number}` and clicking the shutdown button on the sidebar.


New features and improvents

* (Common)
  * Added `Search by Usage` page (navigation bar):
    * This page introduces the details of each visualization of the APDN7, categorized by what insight we want to get.
    * If you have any difficulties choosing a visualization to use, check this page.  
    <img src="https://github.com/apdn7/AnalysisPlatform/assets/106378158/aa17513d-bae7-486f-9f85-b4a498fb9340" alt="SearchByUsage" width="500">
  * Improved context menu on sidebar
    * <img src="https://github.com/apdn7/AnalysisPlatform/assets/106378158/68279d2a-0d4a-450a-8f80-d15d0ed81427" alt="ContextNenu" width="200">
  * Sensor names showin in UI will automatically switched, according to the Process Config / language setting.
    * Now you will see `Local Name` field in the Process Config.
    * Below image shows an example when an user set Español for the Local Name.  
      <img src="https://github.com/apdn7/AnalysisPlatform/assets/106378158/9a8e88a8-1973-4950-aa19-18257e6ae911" alt="ProcessLang" width="500">
    * Then, according to the language setting on the right end of the navigation bar:  
      <img src="https://github.com/apdn7/AnalysisPlatform/assets/106378158/236d07d2-f99f-4fdb-9230-6835e42b0739" alt="LangSetting" width="200">
    * Set to 日本語 (JA): `Japanese Name` is shown
    * Set to English (EN): `English Name` is shown
    * Else: `Local Name` is shown (see below image)  
    <img src="https://github.com/apdn7/AnalysisPlatform/assets/106378158/bfc5c6ae-0a7a-4fa6-9417-599204bbf6aa" alt="LangSwitch" width="500"> 
  * Now we allow users to access APDN7 from iOS, by Chrome/Edge/Safari
  * Added a checkbox on `Label`/`Filter` to select all the checkboxes. 
  * Changed file encodings of exported data files.
    * CSV: UTF-8 with BOM
    * TSV: UTF-8
* (FPP)
  * Imporved the format of x-axis label, against month/year of timeseries chart.
  * Alinged Y-axis lable with dicimal.
    * Now we do not display extra zeros of the decimal points.
* (PCP)
  * Enabled PCatP to synchronize the order of graph lables and the order of the on-demand filter.
  * Added `Categorized Real` mode to show PCatP with columns with data type=Real.
  * Keep color of the Objective variable when user moves the position of columns
* (MSP)
  * Changed the limit of the maximum number of columns from 7 to 64.
  * Now MSP shows scatter plots when number of columns <= 10,  
  and for more columns, a heatmap of correlation coefficients is shown.
* (SkD)
  * Now SkD can handle categorical variables.
  * Added `Jump` feature to jump from SkD to other pages.
    * You can either select to pass all the variables, or important variables selected with SkD.  
    <img src="https://github.com/apdn7/AnalysisPlatform/assets/106378158/3d93b776-ca56-4b3d-9b50-a6c3ed970777" alt="JumpButton" width="400">  
    <br>
    <img src="https://github.com/apdn7/AnalysisPlatform/assets/106378158/f288517a-8128-4777-b699-3dc4556a739f" alt="JumpPage" width="500">
  * Now shows a modal window to notificate user when data has columns with 0 variance or NA ratio.
    * User can reselect valid columns and show the graph again
* (RLP)
  * Added `Judge` option, an option that allows you to calculate and draw NG rate of a variable, with specified conditon.  
  <img src="https://github.com/apdn7/AnalysisPlatform/assets/106378158/42b91e7d-6616-4d57-ad3a-8cb2fe6150cb" alt="Judge" width="400">  
    <br>
    <img src="https://github.com/apdn7/AnalysisPlatform/assets/106378158/bc72a88a-d639-4b29-b416-6df1418e2d8c" alt="Ratio" width="500">
  * In Divide by Term (Cyclic), now user only have to select "From" datetime on the data finder.
  * Improved format of Y-axis on EMD chart
* (PCA)
  * Changed the term `Test Data` to `Target Data`.
  * Added Data finder button for the Target Data.
* (MSP, SkD, PCP, PCA, GL, RLP)
  * Added `Filter` checkbox to specify columns to be included in the on-demand filter.
* (FPP, ScP, MSP)
  * Added `Threshold/Graph config` into context menu of datapoint.
    * Now user can go to Threshold/Graph config page immediately.
* (Config)
  * Datasource config
    * Read latest/largest 5 files only. Add timeout 10s when preview data
  * Process config
    * Now uses 1000 rows to predict data-type instead of 5 files
    * Adjusted marginal space of Process Config modal
    * Default data source in Process Config modal is set to empty, if user did not have selectes previously.
    * Added scroll if there are many columns of a process
  * Data Link Config:
    * Improved UI of data link config.
      * Added a side panel on the left side.
        * User can hide or show processess in the data link window. 
        * User can now easily reset an edge, remove an edge.
    * Added `Auto link` function.  
      * The APDN7 can automatically estimate and link selected processes based on their timestamps.  
      <img src="https://github.com/apdn7/AnalysisPlatform/assets/106378158/8730a3e8-ed97-4fd2-aa64-44b11999a968" alt="AutoLink" width="400">
  * Threshold/Graph Config
    * Changed the term `Master Config` to `Threshold/Graph Config`.
    * improved GUI of Threshold/Graph config table
    * Improved GUI of Threshold/Graph config edit mode.
  * Changed expand/collapse icon
* (Misc)
  * Bookmarks:
    * Added feature to copy the URL of a bookmark, to share with other users.
    * Improved GUI of bookmark list
    * Now highlights the activated bookmark
  * Added 'Variable display ordering' modal.
    * Now user can order selected variables in GUI and graph area.  
    <img src="https://github.com/apdn7/AnalysisPlatform/assets/106378158/fcfb4fc4-858d-4b75-b990-e7d97398a264" alt="Ordering" width="400">  
    <br>
    <img src="https://github.com/apdn7/AnalysisPlatform/assets/106378158/604cd3d4-b223-4512-b718-bfa3720cf2a8" alt="OrderingPage" width="500">
  * Improved logic of writing log file
    * Now the APDN7 splits log file each day, or if a file size become larger than 50MB.
    * Now zips all the log files 1 week after created.
    * Now removes log files older than 30 days.
  * 
  * Sends data to GA4 only after a user acceptes the Term of use.
  * Added a shortcut key : `CTRL + ENTER` to `Display graph`.

Bug fixes

* (FPP)
  * Fixed a bug where tick labels do not appear evenly in step charts
  * Fix to show 'Serial series' modal even when user had copied and pasted the settings
* (PCP)
  * Now shows English name of column when the language is set to English.
  * Keep default setting of graph when pushing show graph again
  * Fixed to show category variable by ascending in PCatP
  * Fixed the ordering of correlation coefficient in PCatP
* (ScP, CHM, PCP, PCA)
  * Fixed to save PNG of graph area with color scale bar
* (MSP)
  * Fixed clipboard of PNG
* (StP)
  * Fixed data name when tab header is long and overlaps.
    * We narrow the data name and add suffix `...`.
* (Config)
  * Data Source Config
    * Show correct error message incase of `Folder not found`, `File not found`, `Access denied`.
  * Process config
    * Show blank instead of None when data is Null in Factory DB.
    * Estimate data-type of datetime with miliseconds.
    * Fixed encode error on preview data.
    * Fixed the function of changing data-type of column and re-registering the settings.
  * Filter config
    * Fixed how to get the unique values of a column.
    * Added loading screen
* (Misc)
  * Fixed an error caused by DB lock on sqlite3.
  * Fixed to filter data of database correctly if data more than 5M records
  * Fixed to launch the AP located under multi-byte charater folder with using R-Portable

## v4.3.1

New features and improvements

* Added `Graphical Lasso (GL)` page
  * You can visualize the partial correlation structure of the given sensor data.  
  <img src="ap/config/image/GL.png" alt="GL" width="500">
* (FPP)
  * Now, the variable with "as datetime" selected on process config page is set as a default for the index order setting
  * Removed "Order set" on Process Config page. Now all categorical variables can be set to index order setting
  * Now x-axis is set to serial series when when drawing data without date/time data (DatetimeDummy)
  * Disabled setting facet and scatter plot display at the same time
* (FPP/MSP)
  * Now adjusts the size of data points when the number of data points is less than 256
* (CHM)
  * Added an option to change the color scales
  * Changed to aggregate datetime (CT) as a real number (min/max/etc.) instead of a categorical data (counts)
  * Added `day of the week` information to hover messages
* (SkD)
  * Changed the limit of selectable target variables from 60 to 512.
  * Added a sample bookmark for binary classification.
* (PCP)
  * Now shows on-demand filters by clicking the variables
  * Changed variable order default to Correlation Coefficient|Top 8
  * Added `Move next to target variable` to the right-click context menu. This will move the selected variable to the left of the target variable
* (RLP)
  * Now the aspect ratio of the charts are adjusted when displaying on a half-screen or vertical monitor, in the same way as the FPP
* (AgP)
  * Added `Divide by term (Cyclic)`, `Divide by term (Direct)`, `Divide by data's number (Cyclic)`
  * Added options of dividing format for `Divide by calendar (Cyclic)`
* (StP)
  * Changed default setting of Y-axis to `common to all graphs` (from "graph setting value")
* (ScP)
  * Added an option to draw lines between the data points
* (Config)
  * `Auto Select` is selected by defaulted when previewing data on Process Config page
  * Now shows warning message when the file does not exist in a folder specified in CSV/TSV Import Config page
  * Now deletes `DatetimeDummy` column when other column is set to "datetime" type on Process Config page.
* Now when `Auto Update` is selected, the charts are updated without refreshing the entire page
* Removed limits on number of tabs we can open on web browser
* Added P1-P99, P5-P95, 6IQR-Major/Minor/Upper/Lower to outlier processing
* Added an option to open in a new tab to the context menu (displayed by right-clicking)
* Added a limit to the `latest` input value for the target period of each page (the upper limit of the target period is about 2 years)
* Changed the priority level of sample settings saved as default in bookmarks from 1 to 0 (Priority 0 cannot be selected in saved settings)

Bugfixes

* (FPP)
  * Fixed a bug that the result of exception value handling is different between normal mode and high speed mode
* (MSP)
  * Fixed a bug where the values of partial correlation coefficient was incorrect
* (CHM)
  * ​​​​​​​​Fixed a bug that could not display the charts when NA existed in the data
  * Fixed a bug that Y-axis variable name and Facet value were not displayed
  * Fixed the order of week numbers on X-axis and days of the week on Y-axis
  * Fixed a bug where the color bar of the output image (screenshot) had no color information
* (PCP)
  * ​​​​​​​​Fixed a bug where the DataFinder button was not displayed on the new page
  * Fixed a bug that a warning toast message appears even if no real variables were selected
  * Fixed a bug where on-demand filter in PCP showed "System" items with no value
  * Fixed a bug where variables other than the starting process in PCP were also displayed in light blue
* (SkD)
  * Fixed a bug that the binary classification is not performed when the target variable is an integer binary
* (StP/MSP)
  * Fixed a bug that the standard line does not appear
* (Config)
  * Fixed a bug that integers larger than int64 were not displayed correctly when previewing at Data Source Config page and Process Config page
  * Fixed a bug that integers with values greater than 2^53-1 were displayed with digit loss when previewing at Data Source Config page and Process Config page
  * Fixed a bug that the real number column including inf/-inf was estimated as a character string instead of a real number on Process Config page
* Fixed a bug where Data finder heatmap was not displayed for data imported from database
* Fixed a bug that the data of the column set as bit type cannot be imported in the target database for data import
* Fixed a bug that data import is not possible when column names with the same half-width and full-width names are mixed in the data source
* Fixed a bug that the density curve does not appear when IQR=0
* Fixed a bug where `Set` button did not work for data types in the search function in the target variable dropdown
* Fixed start-up problems caused by Timezone offset error that may occur when the app is first started

## v4.2.0

New features and improvements

* Added "Aggregation Plot(AgP)" page.
  * This includes stacked bar charts and line charts with aggregated data.
  * For example, you can visualize stacked bar charts of production volume, number of defects along with line chart of aggregated sensor data, and explore their relationships.
  * Added sample data (/sample_data/AgP_sample_data) and a sample bookmark (10-1 AgP).
* (StP/RLP/ScP) Enabled the data finder.
* (FPP/StP/MSP) Changed the sampling logic of kernel density estimation, which is activated when the number of data points is large.
  * Changed from random sampling to equidistant sampling method to preserve minimum, maximum, and median values
* (PCA) In the T2/Q contribution plot, more character strings are displayed in the item names of the bar graphs to be displayed, and the appearance is adjusted.

Bugfixes

* Fixed a bug where an error occurred when importing data from a CSV/TSV file with no column name and the data could not be read (skipping columns with no column name)
* Fixed incorrect week number displayed in calendar picker and Data finder
* (RLP) Fixed a bug that overlapped variable names when the variable name is long.
* (SkD/PCA) Fixed a bug where the original "column name" registered in the data source was displayed instead of the "display name".

## v4.1.2

New features and improvements

* Tour: You can activate a tour to learn the basic usage of the visualization, by clicking "(?)" button on the right of the navigation bar.
* Now shows elapsed time \[sec\] of the visualization, and the timeout to abort the visualization is extended to 10 minutes.
* Improved Data Finder to let user set the datetime range from Year/Month Calender.
* Added search box on the language dropdown list.
* (FPP) You can now control the priority of the columns to sort the data points, by changing the column order on the on-demand filter window.
* (StP/RLP/ScP) Changed minimum value of "Window length" and "Interval" from 0.1 to 0.01.

Bugfixes

* Fixed a bug of duplicate serial detection, where the result change depending on whether filter/on-demand filter is used or not.
  * The Analysis Platform will extract "All", "First" (oldest datetime), or "Last" (latest datetime) record for data points with duplicate serials.
* Fixed a bug that a chattering occur when entering full width number to a halfwidth number textbox.
* (SkD) Fixed a bug that an error could occur on large number of data points (>10,000)

## v4.1.1

This version fixes an issue: the Analysis Platform checks disk usage at an unexpected frequency in a specific condition.

## v4.1.0

This version is a major update including many new functionalities and bugfixes.  
See Upgrade Manual (pdf) if you are currently using the Analysis Platform v4.0.1 or v4.0.0.

Core changes

* Now uses batch file `start_ap.bat` to start the application.
  * Improved error tracing during the activation.
  * Automatically opens web browser and generate shortcuts.
  * Now shows "Port No./Language used/Path of application folder" on the title of the console screen. (Users those activate multiple applications can now distinguish the applications by looking at the title of the console screen)
  * See Getting Started (pdf) for details.
* Default port number is changed to 7770.

New functionalities

* Data import
  * Added a function to read data which uses comma (,) as a decimal point.
  * Added a function to read data which uses commas and periods as thousands separators.
  * Added a function to read CSV/TSV file with no datetime column. Now automatically generates a dummy datetime column when it does not exist.
* Drawing Graphs
  * Functions such as on-demand filter/preprocessing/graph range adjustment/Facet division are deployed horizontally on each page.
  * Added a button to abort graph drawing.
  * Added a preprocessing function that automatically detects and removes sudden values with a large number of data in the surrounding area.
  * Added a function to save the setting information of the graph area, not only the setting area.
* DN7
  * (FPP) Added a function to display multiple switching lines at once from Label plot of Full Points Plot.
  * (MSP) Added a function to highlight in a heat map the order of correlation among the variables selected for the scatterplot matrix.
  * (StP) Added a function to stratify the character string data with a bar graph in the stratified plot.
  * (SkD) Added verification graphs of actual and predicted values, residual error plots, etc. to Sankey Diagram.

Minor changes and bugfixes
* Changed the specification to treat recurring decimals such as "3.3333" and "6.6666" as real numbers without automatically estimating them as exception values.
* A function that automatically adjusts the number of display digits for real numbers is also applied to each data point.
* Fixed a bug that caused an error when visualizing extremely small data and large data (e.g. e-10, e10)
* (MSP) Changed the logic to automatically adjust the threshold for the number of data to switch to high-speed mode in Multi Scatter Plot according to the number of selected variables
* (RLP) Fixed a bug of Facet/Div function in "Divide by category" mode of Ridge Line Plot
* (PCP) Fixed a bug where categorical data were not displayed correctly in Parallel Coordinates Plot
* (PCP) Fixed a bug that caused cast error when calculating correlation coefficients when integer items 
* (PCP) Fixed a bug that caused an error when calculating the correlation coefficient when there was an estimated value for inf/-inf in Parallel Coordinates Plot 
* (FPP) Fixed a bug where outliers disappeared when switching to full range in Full-points Plot
* \+ many other changes/bugfixes

## v4.0.1

This version fixes issues with the activation of the Analysis Platform.

* Fixed bug where Analysis Platform can not activate when changing the directory after initial activation
* Fixed bug in oss_start_app.bat where pip failed to install modules (caused when using pip 22.3)