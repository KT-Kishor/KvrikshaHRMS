sap.ui.define(
  [
    "./BaseController",
    "sap/ui/core/Fragment",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "../utils/validation",
  ],
  function (
    BaseController,
    Fragment,
    Dialog,
    Button,
    JSONModel,
    MessageToast,
    MessageBox,
    utils,
  ) {
    "use strict";
    return BaseController.extend(
      "sap.kt.com.minihrsolution.controller.ManageGoals",
       {
        onInit: function () {
         
          const oViewModel = new JSONModel({
            questionsList: [], // Stores dropdown questions
            selectedCategory: "",
            selectedQuestion: "",
            description: "",
            selectedQuarter: "Q1",
            usedQuarters: {}, // Prevent duplicate quarters
            goals: [], // store all goals
            showFinalSubmit: false,
            showCreateGoal: true,
            showFinalSubmitBtn: false, // control button
            hideCreateGoal: false,
            currentYear: new Date().getFullYear(),
          });
          this.getView().setModel(oViewModel, "viewModel");
          this.getRouter()
            .getRoute("RouteManagegoals")
            .attachPatternMatched(this.MG_onRouteMatched, this);
        },
MG_onRouteMatched: async function (oEvent) {
  var LoginFunction = await this.commonLoginFunction("Goal");
          if (!LoginFunction) return;
          this.getBusyDialog();
          const oView = this.getView();
          this.i18nModel = this.getOwnerComponent()
            .getModel("i18n")
            .getResourceBundle();
        
    const oArgs = oEvent.getParameter("arguments");
    this._sEmployeeId = oArgs.employeeId || "KT003";
    this.getView().getModel("LoginModel")
            .setProperty("/HeaderName", "Manage Goals");
     await this._fetchCommonData("EmployeeDetails", "sEmployeeModel", {
            EmployeeID: this._sEmployeeId
          });
          // ✅ Get fetched data
          const oEmpData = oView.getModel("sEmployeeModel")?.getData();
           const oEmployeeModel = new JSONModel({
            name: oEmpData[0].EmployeeName || "",
            designation: oEmpData[0].Designation || "",
            department: oEmpData[0].Department || "",
            manager: oEmpData[0].ManagerName || "",
            email: oEmpData[0].EmployeeEmail || "",
            mobile: oEmpData[0].MobileNo || "",
            image: oEmpData[0].ProfilePhoto
              ? "data:image/png;base64," + oEmpData[0].ProfilePhoto
              : ""
          });
          oView.setModel(oEmployeeModel, "employeeModel");
    const sFrom = oArgs.from || "";
    const oViewModel = this.getView().getModel("viewModel");
    oViewModel.setProperty("/fromPage", sFrom);
    // Approval mode
    oViewModel.setProperty(
        "/showApprovalButtons",
        sFrom === "GoalReview"
    );
    // Create button
    oViewModel.setProperty(
        "/showCreateGoal",
        sFrom !== "GoalReview"
    );
    this.MG_loadTopics();
    this.MG_loadGoals();
},
        _getText: function (sKey) {
          return this.getOwnerComponent()
            .getModel("i18n")
            .getResourceBundle()
            .getText(sKey);
        },
        MG_validateDialog: function () {
          const { question, description } = this.MG_getDialogControls();
          return (
            utils._LCstrictValidationComboBox(question, "ID") &&
            utils._LCvalidateMandatoryField(description, "ID")
          );
        },
        MG_onDescriptionChange: function (oEvent) {
          utils._LCvalidateMandatoryField(oEvent);
        },
FMG_onQuestionSelect: function (oEvent) {

    var oComboBox =
        oEvent.getSource();

    var sSelectedKey =
        oComboBox.getSelectedKey();

    var sValue =
        oComboBox.getValue();

    // =========================
    // CLEAR ERROR
    // =========================

    if (

        (sSelectedKey &&
         sSelectedKey.trim() !== "")

        ||

        (sValue &&
         sValue.trim() !== "")

    ) {

        oComboBox.setValueState("None");

        oComboBox.setValueStateText("");

    }

    // =========================
    // SHOW ERROR
    // =========================

    else {

        oComboBox.setValueState("Error");

        oComboBox.setValueStateText(
            this._getText("SelectQuestion")
        );
    }
},
        MG_getDialogControls: function () {
          const sViewId = this.getView().getId();
          return {
            question: sap.ui.core.Fragment.byId(sViewId, "FMG_id_QuestionBox"),
            description: sap.ui.core.Fragment.byId(
              sViewId,
              "FMG_id_DescriptionBox",
            ),
          };
        },
        onLogout: function () {
                this.CommonLogoutFunction();
            },

 _getQuarterDates: function (sQuarter) {

    const currentYear = new Date().getFullYear();

    let startDate = "";
    let endDate = "";

    switch (sQuarter) {

        case "Q2":
            startDate = currentYear + "-04-01";
            endDate = currentYear + "-06-30";
            break;

        case "Q3":
            startDate = currentYear + "-07-01";
            endDate = currentYear + "-09-30";
            break;

        case "Q4":
            startDate = currentYear + "-10-01";
            endDate = currentYear + "-12-31";
            break;

        case "Q1":
            startDate = currentYear + "-01-01";
            endDate = currentYear + "-03-31";
            break;

    }

    return {
        StartDate: startDate,
        EndDate: endDate
    };
},
 MG_loadGoals: async function () {
  try {

    this.getBusyDialog();

    const oViewModel = this.getView().getModel("viewModel");
    const sFrom = oViewModel.getProperty("/fromPage");

    // =========================
    // BUILD FILTER OBJECT
    // =========================
    let oFilters = {
      EmployeeID: this._sEmployeeId
    };

    // IF COMING FROM GOAL REVIEW
    // PASS STATUS ALSO
    if (sFrom === "GoalReview") {

      oFilters.Status =
        "Submitted,Approved,Rejected,Resubmit Solution,Goal Submitted,Reject Solution,Approved Solution";
    }
// =========================
// READ API
// =========================
const res = await this.ajaxReadWithJQuery(
  "/Goals",
  oFilters
);

const data = res.data || [];

const today = new Date();
const empId = this._sEmployeeId;

// LOCKED STATUS LIST
const aLockedStatuses = [
  "Submitted",
  "Approved",
  "Rejected",
  "Resubmit Solution",
  "Goal Submitted",
  "Reject Solution",
  "Approved Solution"
];

// CURRENT EMPLOYEE CURRENT QUARTER GOALS
const userGoals = data.filter((g) => {

 

  return (
    g.EmpID === empId
  );

});

console.log("USER GOALS =", userGoals);

// ==============================
// HIDE MANAGE GOAL
// ==============================
const bHideManageGoal =
  userGoals.length > 0 &&
  userGoals.every(g =>
    aLockedStatuses.includes(g.Status)
  );


// ==============================
// CHECK FINAL SUBMIT STATUS
// ==============================
const allSubmitted =
  userGoals.length === 4 &&
  userGoals.every(g =>
    g.Status === "Submitted"
  );



// ==============================
// SHOW FINAL SUBMIT BUTTON
// ==============================
const showFinalSubmit =
  userGoals.length === 4 &&
  userGoals.every(g =>
    g.Status === "New"
  );


// ==============================
// BUTTON VISIBILITY
// ==============================

// CREATE GOAL BUTTON
let bShowCreateGoal = !bHideManageGoal;

// MANAGER PAGE
if (sFrom === "GoalReview") {
  bShowCreateGoal = false;
}

// FINAL MODEL UPDATE
oViewModel.setProperty(
  "/showCreateGoal",
  bShowCreateGoal
);

oViewModel.setProperty(
  "/showFinalSubmit",
  showFinalSubmit
);

oViewModel.setProperty(
  "/isFinalSubmitted",
  allSubmitted
);

oViewModel.setProperty(
  "/showApprovalButtons",
  sFrom === "GoalReview"
);
    // RENDER CARDS
    this.MG_renderDynamicYears(userGoals);

  } catch (error) {

    console.log("LOAD GOALS ERROR =", error);

  } finally {

    this.closeBusyDialog();

  }
},
       MG_renderDynamicYears: function (aGoals) {

    var oVBox =
        this.byId("MG_id_YearContainer");

    oVBox.removeAllItems();

    var grouped = {};

    var today = new Date();

    var currentYear =
        today.getFullYear();

    // =========================
    // NO GOALS
    // =========================

    if (!aGoals || aGoals.length === 0) {

        return;
    }

    // =========================
    // GROUP GOALS BY YEAR
    // =========================

    aGoals.forEach(function (goal) {

        var year = "No Year";

        if (
            goal.StartDate &&
            goal.EndDate
        ) {

            var start =
                new Date(goal.StartDate);

            var end =
                new Date(goal.EndDate);

            if (
                !isNaN(start.getTime()) &&
                !isNaN(end.getTime())
            ) {

                if (
                    today >= start &&
                    today <= end
                ) {

                    year = currentYear;

                } else {

                    year =
                        start.getFullYear();
                }
            }
        }

        if (!grouped[year]) {

            grouped[year] = [];
        }

        grouped[year].push(goal);

    });

    // =========================
    // SORT YEARS
    // =========================

    var aYears =
        Object.keys(grouped)
        .sort(function (a, b) {

            if (a === "No Year") return 1;

            if (b === "No Year") return -1;

            return b - a;

        });

    var that = this;

    // =========================
    // CREATE PANELS
    // =========================

    aYears.forEach(function (year) {

        // SKIP EMPTY YEAR

        if (
            !grouped[year] ||
            grouped[year].length === 0
        ) {
            return;
        }

        var oPanel =
            new sap.m.Panel({

                expandable: true,

                expanded: true,

                width: "100%",

                headerToolbar:
                    new sap.m.Toolbar({

                        content: [

                            new sap.m.Title({
                                text:
                                    year +
                                    " (Goals)"
                            }),

                            new sap.m.ToolbarSpacer()

                        ]
                    }),

                content: [
                    that.MG_createCards(
                        grouped[year]
                    )
                ]

            }).addStyleClass(
                "goalYearPanel"
            );

        oVBox.addItem(oPanel);

    });

},
  FMG_onFinalSubmit: function () {
  var that = this;
  MessageBox.confirm(
    "Are you sure you want to final submit goals?",
    {
      title: "Final Submission",
      actions: [
        MessageBox.Action.OK,
        MessageBox.Action.CANCEL
      ],
      emphasizedAction: MessageBox.Action.OK,
      onClose: function (oAction) {
        if (oAction !== MessageBox.Action.OK) {
          return;
        }
        that.getBusyDialog();
        that.ajaxReadWithJQuery("/Goals", {})
          .then(function (res) {
            var allGoals = res.data || [];
            var today = new Date();
            var userGoals = allGoals.filter(function (g) {
            
              return (
                g.EmpID === that._sEmployeeId 
               
              );
            });
          
            // MUST HAVE 4 GOALS
            if (userGoals.length !== 4) {
              MessageBox.error(
                "Please create exactly 4 goals before final submit."
              );
              throw new Error("INVALID_GOAL_COUNT");
            }
            // ALL GOALS MUST BE NEW
            var invalidGoals = userGoals.filter(function (g) {
              return (
                g.Status !== "New"
              );
            });
            if (invalidGoals.length > 0) {
              MessageBox.error(
                "Some goals are already submitted."
              );
              throw new Error("INVALID_STATUS");
            }


var aGoalUpdates = userGoals.map(function (goal) {

    return {

        data: {
            Status: "Submitted",
            EmpID: goal.EmpID,
        },

        filters: {
            GoalID: goal.GoalId
        }

    };

});

// ==========================
// FINAL PAYLOAD
// ==========================

var oPayload = {

    type: "FinalSubmit",

    data: aGoalUpdates

};

// ==========================
// SINGLE API CALL
// ==========================

return that.ajaxUpdateWithJQuery(
    "/Goals",
    oPayload
);
          }) 
        .then(function () {
            var oViewModel = that
              .getView()
              .getModel("viewModel");
            // HIDE BUTTONS
            oViewModel.setProperty(
              "/showCreateGoal",
              false
            );
            oViewModel.setProperty(
              "/showFinalSubmit",
              false
            );
            oViewModel.setProperty(
              "/isFinalSubmitted",
              true
            );
            oViewModel.refresh(true);
            // CLOSE DIALOG
            if (that._oDialog) {
              that._oDialog.close();
            }
            // RELOAD GOALS
            that.MG_loadGoals();
            MessageToast.show(
              "Goals submitted successfully."
            );
          })
          .catch(function (err) {
            console.log("FINAL SUBMIT ERROR =", err);
            if (
              err.message !== "INVALID_GOAL_COUNT" &&
              err.message !== "INVALID_STATUS"
            ) {
              MessageBox.error(
                "Final submit failed."
              );
            }
          })
          .finally(function () {
            that.closeBusyDialog();
          });
      }
    }
  );
},
        MG_createCards: function (aGoals) {
          var oViewModel = this.getView().getModel("viewModel");
          var bShowApprovalButtons =
            oViewModel.getProperty("/showApprovalButtons") === true;
          var oGrid = new sap.ui.layout.Grid({
            defaultSpan: "L6 M6 S12",
            hSpacing: 1,
            vSpacing: 1,
            width: "100%",
            containerQuery: true
          }).addStyleClass("goalGrid");
          var fixedGoals = this._buildFixedFourGoals(aGoals || []);
          var isFinalSubmitted =
            oViewModel.getProperty("/isFinalSubmitted") === true;
          for (var i = 0; i < fixedGoals.length; i++) {
            var goal = fixedGoals[i];
            var oCard = new sap.ui.integration.widgets.Card({
              manifest: sap.ui.require.toUrl(
                "sap/kt/com/minihrsolution/cards/actionCard.json",
              ),

              parameters: {
                GoalId: goal.GoalId || "",
                Topic: goal.Topic || "No Goal",
                Quarter: goal.Quarter || "",
                Description: goal.Description || "No Description",
                isEmpty: goal.isEmpty,
                isFinalSubmitted: isFinalSubmitted,

                // IMPORTANT
                showApprovalButtons: bShowApprovalButtons,
              },
            });

            oCard.addStyleClass(goal.isEmpty ? "emptyGoalCard" : "goalCards");
            oGrid.addContent(oCard);
          }

          return oGrid;
        },

        _setBusy: function (bBusy) {
          if (bBusy) {
            sap.ui.core.BusyIndicator.show(0);
          } else {
            sap.ui.core.BusyIndicator.hide();
          }
        },

        MG_onCreatePress: function () {
          var that = this;
          var oModel = this.getView().getModel("viewModel");

          oModel.setProperty("/selectedCategory", "");
          oModel.setProperty("/selectedQuestion", "");
          oModel.setProperty("/description", "");
          oModel.setProperty("/questionsList", []);

          // keep default Q1 instead of empty
          oModel.setProperty("/selectedQuarter", "Q1");

          if (!this._oDialog) {
            sap.ui.core.Fragment.load({
              id: this.getView().getId(),
              name: "sap.kt.com.minihrsolution.fragment.ManageGoals",
              controller: this,
            }).then(function (oDialog) {
              that._oDialog = oDialog;
              that.getView().addDependent(oDialog);
              oDialog.open();
            });
          } else {
            this._oDialog.open();
          }
        },

        FMG_onCategoryChange: function (oEvent) {


          var oComboBox =
        oEvent.getSource();

    var sKey =
        oComboBox.getSelectedKey();

    var sValue =
        oComboBox.getValue();

    // =========================
    // CLEAR ERROR
    // =========================

    if (
        sKey ||
        (sValue && sValue.trim() !== "")
    ) {

        oComboBox.setValueState("None");

        oComboBox.setValueStateText("");
    }

    var that = this;
    this.getBusyDialog();

    var sTopic =
        oEvent.getSource().getSelectedKey();

    var oModel =
        this.getView().getModel("viewModel");

    // =========================
    // EDIT MODE FLAG
    // =========================

    var isEdit =
        oModel.getProperty("/isEditMode");

    // =========================
    // SET Topic
    // =========================

    if (!isEdit) {

        oModel.setProperty(
            "/selectedCategory",
            sTopic
        );
    }

    // RESET QUESTION LIST

    oModel.setProperty(
        "/questionsList",
        []
    );

    // =========================
    // LOAD QUESTIONS
    // =========================

    this.ajaxReadWithJQuery(
        "/GoalQuestions",
        {}
    )

    .then(function (res) {

        var data = res.data || [];
        that._aGoalQuestions = data;
        var filteredQuestions =
            data
            .filter(function (item) {

                return item.Topic === sTopic;

            })

            .map(function (item) {

                return {
                    Question: item.Question
                };

            });

        oModel.setProperty(
            "/questionsList",
            filteredQuestions
        );

        // LOAD GOALS

        return that.ajaxReadWithJQuery(
            "/Goals",
            {}
        );

    })

    .then(function (res) {

        var allGoals =
            res.data || [];

        var empId =
            that._sEmployeeId || "KT003";

        // =========================
        // FIND EXISTING GOAL
        // =========================

        var existingGoal =
            allGoals.find(function (g) {

                return (
                    g.EmpID === empId &&
                    g.Topic === sTopic
                );

            });

        // =========================
        // EDIT MODE
        // =========================

        if (existingGoal) {

            oModel.setProperty(
                "/selectedCategory",
                existingGoal.Topic || sTopic
            );

            oModel.setProperty(
                "/selectedQuarter",
                existingGoal.Quarter || "Q1"
            );

            oModel.setProperty(
                "/selectedQuestion",
                existingGoal.Question || ""
            );

            oModel.setProperty(
                "/description",
                existingGoal.Description || ""
            );

            oModel.setProperty(
                "/editingGoalId",
                existingGoal.GoalId
            );

            oModel.setProperty(
                "/isEditMode",
                true
            );

        }

        // =========================
        // CREATE MODE
        // =========================

        else {

            oModel.setProperty(
                "/selectedQuestion",
                ""
            );

            oModel.setProperty(
                "/description",
                ""
            );

            oModel.setProperty(
                "/selectedQuarter",
                "Q1"
            );

            oModel.setProperty(
                "/editingGoalId",
                null
            );

            oModel.setProperty(
                "/isEditMode",
                false
            );

            oModel.setProperty(
                "/selectedCategory",
                sTopic
            );
        }

    })

    .catch(function () {

        MessageToast.show(
            that._getText("LoadDataFailed")
        );

    })

    .finally(function () {

        that.closeBusyDialog();

    });

},
        FMG_onQuarterSelect: function (oEvent) {
          var oModel = this.getView().getModel("viewModel");
          // IMPORTANT FIX
          // For ComboBox use getSource().getSelectedKey()
          var sQuarter = oEvent.getSource().getSelectedKey();
         
          var sCategory = oModel.getProperty("/selectedCategory");
        
          if (!sCategory) {
            MessageToast.show("Please select Topic first");
            oModel.setProperty("/selectedQuarter", "Q1");
            return;
          }
          var that = this;

          this.getBusyDialog();

          this.ajaxReadWithJQuery("/Goals", {})

            .then(function (res) {
              var allGoals = res.data || [];

               that.closeBusyDialog();

          
              var today = new Date();

              var empId = that._sEmployeeId || "KT003";
              // FILTER CURRENT USER GOALS
              var userGoals = allGoals.filter(function (g) {
               

                return g.EmpID === empId;
              });


              // CHECK QUARTER DUPLICATE
              var conflictGoal = userGoals.find(function (g) {
                console.log("Comparing =", g.Quarter, "WITH", sQuarter);

                return (
                  g.Quarter &&
                  sQuarter &&
                  g.Quarter.trim().toUpperCase() ===
                    sQuarter.trim().toUpperCase()
                );
              });

              console.log("CONFLICT GOAL =", conflictGoal);

              // DUPLICATE FOUND
              if (conflictGoal) {
                MessageBox.error(
                  "The quarter '" +
                    sQuarter +
                    "' has already been assigned to the topic '" +
                    conflictGoal.Topic +
                    "'. Please choose a different quarter.",
                  {
                    title: "Quarter Already Assigned",
                  },
                );

                // RESET INVALID SELECTION
                oModel.setProperty("/selectedQuarter", "");

                return;
              }

              // VALID SELECTION
              oModel.setProperty("/selectedQuarter", sQuarter);

              console.log("Quarter Assigned Successfully");
            })

            .catch(function (err) {
              console.log("QUARTER ERROR =", err);

              MessageToast.show("Quarter validation failed");
            })

            .finally(function () {
              console.log("========== QUARTER SELECT END ==========");

              that.closeBusyDialog();
            });
        },

      FMG_onCancel: function () {

    var oModel =
        this.getView().getModel("viewModel");
    oModel.setProperty( "/selectedCategory", "");
    oModel.setProperty( "/selectedQuestion","");
    oModel.setProperty( "/description","");
    oModel.setProperty( "/selectedQuarter","Q1");
    oModel.setProperty("/questionsList", []);
    oModel.setProperty("/isEditMode", false);
    oModel.setProperty(  "/editingGoalId", null );

    this.byId("topicCombo").setSelectedKey("");
    this.byId("topicCombo").setValue("");
    this.byId("FMG_id_QuestionBox").setSelectedKey("");
    this.byId("FMG_id_QuestionBox").setValue("");

    this.byId("FMG_id_DescriptionBox").setValue("");

    this.byId("topicCombo").setValueState("None");
    this.byId("FMG_id_QuestionBox").setValueState("None");
    this.byId("FMG_id_DescriptionBox").setValueState("None");
    this.byId("topicCombo").setValueStateText("");
    this.byId("FMG_id_QuestionBox").setValueStateText("");
    this.byId("FMG_id_DescriptionBox").setValueStateText("");

    // =========================
    // CLOSE DIALOG
    // =========================

    if (this._oDialog) {

        this._oDialog.close();

    }
},
        FMG_onSave: async function () {
          var oModel = this.getView().getModel("viewModel");  
          var isEdit = oModel.getProperty("/isEditMode");
          var editingId = oModel.getProperty("/editingGoalId");
          var oEmpData = this.getView().getModel("sEmployeeModel")?.getData()
          var Empdepartment = oEmpData[0].Department || "";
          var that = this;
          var quarterDates = this._getQuarterDates(
    oModel.getProperty("/selectedQuarter")
);
          var goal = {
           
            Topic: oModel.getProperty("/selectedCategory"),
            Question: this.byId("FMG_id_QuestionBox").getValue(),
            Description: oModel.getProperty("/description"),
            Quarter: oModel.getProperty("/selectedQuarter"),
            EmpID: this._sEmployeeId,
            EmpName: this.getView()
    .getModel("employeeModel")
    .getProperty("/name"),
           
           StartDate: quarterDates.StartDate,
           EndDate: quarterDates.EndDate,
          Status: "New",
          };
          if (isEdit) {

    goal.GoalId =
        editingId;
}

          // ================= VALIDATION =================
         var oCategory =
    this.byId("topicCombo");

if (
    !goal.Topic ||
    goal.Topic.trim() === ""
) {

    oCategory.setValueState("Error");

    oCategory.setValueStateText(
        this._getText("SelectCategory")
    );

    return;

} else {

    oCategory.setValueState("None");

    oCategory.setValueStateText("");
}
          var oQ = this.byId("FMG_id_QuestionBox");
          if (!goal.Question ||

    goal.Question.trim() === "") {
            oQ.setValueState("Error");
            oQ.setValueStateText(this._getText("SelectQuestion"));
            return;
          } else {
            oQ.setValueState("None");
             oQ.setValueStateText("");
          }
          var oD = this.byId("FMG_id_DescriptionBox");
          if (!goal.Description || goal.Description.trim() === "") {

    oD.setValueState("Error");
    oD.setValueStateText(this._getText("EnterDescription"));
    return;

} else {

    // WORD COUNT VALIDATION
    const aWords = goal.Description
        .trim()
        .split(/\s+/);

    if (aWords.length < 5) {

        oD.setValueState("Error");
        oD.setValueStateText("Please enter at least 5 words");
        return;

    } else {

        oD.setValueState("None");

    }
}
          if (!goal.Quarter) {
            MessageToast.show(this._getText("SelectQuarterMsg"));
            return;
          }
// =========================
// USE EXISTING QUESTION DATA
// =========================

if (!isEdit) {

    goal.Department =
        Empdepartment;


    // CHECK QUESTION EXISTS

    const aQuestions =
        this._aGoalQuestions || [];

    const bQuestionExists =
        aQuestions.some(function (item) {

            return (

                item.Question &&
                item.Question.trim().toLowerCase()

                ===

                goal.Question.trim().toLowerCase()
            );

        });

    goal.Type =
        bQuestionExists

        ? "Edit"

        : "Create Goal Question";
}
          
          // Start Busy
          this.getBusyDialog();
          this.ajaxReadWithJQuery("/Goals", {})
            .then(function (res) {
              var allGoals = res.data || [];
              // numeric description validation
              var desc = goal.Description || "";
              if (/^[0-9]+$/.test(desc.trim())) {
                MessageBox.error(that._getText("DescNumberError"));
                throw new Error("Validation failed");
              }
              var today = new Date();
              const empId = that._sEmployeeId;
              var userGoals = allGoals.filter(function (g) {
            
                return g.EmpID === empId;
              });
              // ================= CREATE MODE =================
              if (!isEdit) {
                if (userGoals.length >= 4) {
                  MessageBox.error(that._getText("MaxGoalsError"));
                  throw new Error("Limit reached");
                }
                var conflictGoal = userGoals.find(function (g) {
                  return g.Quarter === goal.Quarter;
                });
                if (conflictGoal) {
                    MessageBox.error(
                  "The quarter '" +
                    goal.Quarter +
                    "' has already been assigned to the topic '" +
                    conflictGoal.Topic +
                    "'. Please choose a different quarter.",
                  {
                    title: "Quarter Already Assigned",
                  },
                );
                  // MessageBox.error(
                  //   that._getText("QuarterConflict", [
                  //     goal.Quarter,
                  //     conflictGoal.Topic,
                  //   ]),
                  // );
                  throw new Error("Duplicate quarter");
                }
                return that
                  .ajaxCreateWithJQuery("/Goals", { data: goal })
                  .then(function () {

    that.byId("FMG_id_QuestionBox")
        .setValue("");

    MessageToast.show(
        that._getText("GoalCreated")
    );

    that.MG_loadGoals();

    that._oDialog.close();
});
              }
              // ================= EDIT MODE =================
              if (isEdit && editingId) {
                var conflictGoal = userGoals.find(function (g) {
                  return g.Quarter === goal.Quarter && g.GoalId !== editingId;
                });
                if (conflictGoal) {
                  MessageBox.error(
                    that._getText("QuarterConflict", [
                      goal.Quarter,
                      conflictGoal.Topic,
                    ]),
                  );
                  throw new Error("Duplicate quarter");
                }
                return that
                  .ajaxUpdateWithJQuery("/Goals", {
                    filters: { GoalId: editingId },
                    data: goal,
                  })
                  .then(function () {
                    MessageToast.show(that._getText("GoalUpdated"));
                    oModel.setProperty("/isEditMode", false);
                    oModel.setProperty("/editingGoalId", null);
                    that.MG_loadGoals();
                    that._oDialog.close();
                  });
              }
            })
            .catch(function (err) {
              console.log("ERROR:", err);
              if (
                err.message !== "Validation failed" &&
                err.message !== "Limit reached" &&
                err.message !== "Duplicate quarter"
              ) {
                MessageBox.error(that._getText("SaveFailed"));
              }
            })
            .finally(function () {
              that.closeBusyDialog();
            });
        },
        _saveGoal: function () {
          var oModel = this.getView().getModel("viewModel");
          var quarterDates = this._getQuarterDates(
    oModel.getProperty("/selectedQuarter")
);
          var payload = {
            data: {
              Topic: oModel.getProperty("/selectedCategory"),
              Question: oModel.getProperty("/selectedQuestion"),
              Description: oModel.getProperty("/description"),
              Quarter: oModel.getProperty("/selectedQuarter"),
              EmpId: "EMP001",
              EmpName: this.getView()
    .getModel("employeeModel")
    .getProperty("/name"),
            StartDate: quarterDates.StartDate,
EndDate: quarterDates.EndDate,
              Status: "New",
            },
          };
          this.ajaxCreateWithJQuery("/Goals", payload)
            .then(() => {
              MessageToast.show("Saved Successfully");
              this.MG_loadGoals();
            })
            .catch(() => {
              MessageToast.show("Save failed");
            });
        },
        // MG_onDescriptionChange: function (oEvent) {
        //   var sValue = oEvent.getParameter("value");

        //   // update model (optional but good practice)
        //   this.getView()
        //     .getModel("viewModel")
        //     .setProperty("/description", sValue);

        //   this.byId("FMG_id_DescriptionBox").setValueState("None");
        // },
        MG_loadTopics: function () {
          var that = this;
          this.getBusyDialog();
          const empId = this._sEmployeeId;
          var sDepartment = this.getView()
            .getModel("employeeModel")
            .getProperty("/department");
          this.ajaxReadWithJQuery("/GoalQuestions", {})
            .then(function (res) {
              var data = res.data || [];
              if (!Array.isArray(data) || data.length === 0) {
                return;
              }
              //  FILTER BY DEPARTMENT
              var filteredData = data.filter(function (item) {
                return item.Department === sDepartment;
              });
              // extract unique topics
              var uniqueTopics = [
                ...new Set(filteredData.map((item) => item.Topic)),
              ];
              var formattedTopics = uniqueTopics.map(function (t) {
                return {
                  Topic: t,
                };
              });
              var oModel = that.getView().getModel("topicModel");
              if (!oModel) {
                oModel = new JSONModel();
                that.getView().setModel(oModel, "topicModel");
              }
              oModel.setProperty("/topics", formattedTopics);
            })
            .catch(function (err) {
              console.log("ERROR loading topics:", err);
            })
            .finally(() => {
              that.closeBusyDialog();
            });
        },
        onExit: function () {
          if (this._oDialog) {
            this._oDialog.destroy();
          }
        },
     _buildFixedFourGoals: function (aGoals) {

    // =========================
    // QUARTER SORT ORDER
    // =========================

    var aQuarterOrder = {
        "Q1": 1,
        "Q2": 2,
        "Q3": 3,
        "Q4": 4
    };

    // =========================
    // SORT GOALS BY QUARTER
    // =========================

    return (aGoals || [])

        .sort(function (a, b) {

            return (
                (aQuarterOrder[a.Quarter] || 99) -
                (aQuarterOrder[b.Quarter] || 99)
            );

        })

        .map(function (goal) {

            return {
                ...goal,
                isEmpty: false
            };

        });

},
     MG_onNavBack: function () {
    const sFrom = this.getView()
        .getModel("viewModel")
        .getProperty("/fromPage");
    // If coming from Goal Review / Employee Details
    if (sFrom === "GoalReview" || sFrom === "EmployeeDetails") {
        this.getRouter().navTo("RouteEmployeeDetails", {
            sPath: "GoalEmployeeDetailsManageGoal",
        });
    } else {
        // Default → go back to Tile Page
        this.getRouter().navTo("RouteTilePage");
    }
},
        isQuarterDisabled: function (sQuarter) {
          var oModel = this.getView().getModel("viewModel");
          var used = oModel.getProperty("/usedQuarters") || {};
          var currentYear = new Date().getFullYear().toString();
          return !!(used[currentYear] && used[currentYear][sQuarter]);
        },
        // FMG_onQuestionSelect: function (oEvent) {
        //   var oModel = this.getView().getModel("viewModel");
        //   var sQuestion = oEvent.getParameter("selectedItem").getText();
        //   oModel.setProperty("/selectedQuestion", sQuestion);
        //   this.byId("FMG_id_QuestionBox").setValueState("None");
        // },
      },
    );
  },
);