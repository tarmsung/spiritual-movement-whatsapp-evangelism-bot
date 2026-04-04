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
    EXECUTOR_FETCH_DATA_GET_STATS_CLUSTER: 113,
    EXECUTOR_FETCH_DATA_REPORTS_SUMMARY_CLUSTER: 114,
    EXECUTOR_FETCH_DATA_MONTH: 115,

    // Add Member flow (120–126)
    EXECUTOR_ADD_MEMBER_GENDER:   120,
    EXECUTOR_ADD_MEMBER_FNAME:    121,
    EXECUTOR_ADD_MEMBER_SURNAME:  122,
    EXECUTOR_ADD_MEMBER_CLUSTER:  123,
    EXECUTOR_ADD_MEMBER_ID:       124,
    EXECUTOR_ADD_MEMBER_CONFIRM:  125,

    // Disable Member flow (130–131)
    EXECUTOR_DISABLE_MEMBER_ID:      130,
    EXECUTOR_DISABLE_MEMBER_CONFIRM: 131,

    // View Cluster flow (140)
    EXECUTOR_VIEW_CLUSTER_SELECT: 140,
};

/**
 * Standard closing message for the SM chatbot
 */
export const CANCEL_MESSAGE = 'Thank you for using the SM chatbot. I am here to assist you 24/7! 🙏🏾';
