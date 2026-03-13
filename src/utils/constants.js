/**
 * Menu step constants (Integers)
 * Used to store session state in the database
 * Starting from 100 to avoid conflicts with reportForm steps (0-13)
 */
export const MENU_STEPS = {
    MEMBER_MAIN: 100,
    MEMBER_WAIT: 101,
    EXECUTOR_MAIN: 110,
    EXECUTOR_WAIT: 111,
    EXECUTOR_FETCH_DATA: 112,
    EXECUTOR_FETCH_DATA_GET_STATES_CLUSTER: 113,
    EXECUTOR_FETCH_DATA_REPORTS_SUMMARY_CLUSTER: 114
};
