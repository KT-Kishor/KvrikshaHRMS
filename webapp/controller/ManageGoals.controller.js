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
    "sap/ui/integration/widgets/Card"
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
    Card
  ) {
    "use strict";

    return BaseController.extend(
      "sap.kt.com.minihrsolution.controller.ManageGoals",
      {
       onInit: async function () {
   
    //  Routing
    this.getRouter()
        .getRoute("RouteManagegoals")
        .attachPatternMatched(this.MG_onRouteMatched, this);
},

        MG_onRouteMatched: async function () {
             var LoginFunction = await this.commonLoginFunction("Goal");
    if (!LoginFunction) return;
          this.getBusyDialog();
    const oView = this.getView();
 this.i18nModel = this.getOwnerComponent()
            .getModel("i18n")
            .getResourceBundle();
    // ✅ Get LoginModel correctly
    const oLoginModel = this.getOwnerComponent().getModel("LoginModel");

    if (oLoginModel) {
        this.EmployeeID = oLoginModel.getProperty("/EmployeeID");
        this.oLoginModel = oLoginModel.getData();
    }

    // ✅ Call API and WAIT for response
    await this._fetchCommonData("EmployeeDetails", "sEmployeeModel", {
        EmployeeID: this.EmployeeID
    });

    // ✅ Get fetched data
    const oEmpData = oView.getModel("sEmployeeModel")?.getData();

    // ✅ Create employee model with real data
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
    // ✅ View Model
    const oViewModel = new JSONModel({
        questionsList: [],
        selectedCategory: "",
        selectedQuestion: "",
        description: "",
        selectedQuarter: "Q1",
        usedQuarters: {},
        goals: [],
        showFinalSubmit: false,
        showCreateGoal: false,
        showFinalSubmitBtn: false,
        hideCreateGoal: false,
        currentYear: new Date().getFullYear()
    });

    oView.setModel(oViewModel, "viewModel");

    // Header update
    oLoginModel.setProperty("/HeaderName", this.i18nModel.getText("managegoals"));
          // ALWAYS reload fresh data
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
          utils._LCstrictValidationComboBox(oEvent);
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

        MG_loadGoals: async function () {
          try {
            this.getBusyDialog();
            const res = await this.ajaxReadWithJQuery("Goals", {});
            const data = res.data || [];
            const today = new Date();
            const userGoals = data.filter((g) => {
              const start = new Date(g.StartDate);
              const end = new Date(g.EndDate);
              return g.EmpID === "EMP001" && today >= start && today <= end;
            });

            const oModel = this.getView().getModel("viewModel");

            const isFinalSubmitted =
              oModel.getProperty("/isFinalSubmitted") === true;

            oModel.setProperty("/showCreateGoal", !isFinalSubmitted);
            oModel.setProperty("/showFinalSubmit", userGoals.length === 4);

            this.MG_renderDynamicYears(data);
          } catch (error) {
            console.log(error);
          } finally {
            this.closeBusyDialog();
          }
        },

        MG_renderDynamicYears: function (aGoals) {
          var oVBox = this.byId("MG_id_YearContainer");
          oVBox.removeAllItems();

          var grouped = {};
          var today = new Date();
          var currentYear = today.getFullYear();

          // FIX: FORCE EMPTY STATE
          if (!aGoals || aGoals.length === 0) {
            grouped[currentYear] = []; // ðŸ”¥ create empty group
          } else {
            aGoals.forEach(function (goal) {
              var year = "No Year";

              if (goal.StartDate && goal.EndDate) {
                var start = new Date(goal.StartDate);
                var end = new Date(goal.EndDate);

                if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                  if (today >= start && today <= end) {
                    year = currentYear;
                  } else {
                    year = start.getFullYear();
                  }
                }
              }

              if (!grouped[year]) {
                grouped[year] = [];
              }

              grouped[year].push(goal);
            });
          }

          var aYears = Object.keys(grouped).sort(function (a, b) {
            if (a === "No Year") return 1;
            if (b === "No Year") return -1;

            return b - a;
          });

          var that = this;

          aYears.forEach(function (year) {
            var oPanel = new sap.m.Panel({
              expandable: true,
              expanded: true,
              width: "100%",
              headerToolbar: new sap.m.Toolbar({
                content: [
                  new sap.m.Title({ text: year + " (Goals)" }),
                  new sap.m.ToolbarSpacer(),
                ],
              }),
              content: [that.MG_createCards(grouped[year])],
            }).addStyleClass("goalYearPanel");

            oVBox.addItem(oPanel);
          });
        },

        FMG_onFinalSubmit: function () {
          var that = this;

          MessageBox.confirm(this._getText("ConfirmFinalSubmit"), {
            actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
            onClose: function (oAction) {
              if (oAction === MessageBox.Action.OK) {
                var oModel = that.getView().getModel("viewModel");

                oModel.setProperty("/isFinalSubmitted", true);
                oModel.setProperty("/showCreateGoal", false);

                oModel.refresh(true);

                if (that._oDialog) {
                  that._oDialog.close();
                }

                MessageToast.show(that._getText("FinalSubmitSuccess"));
              }
            },
          });
        },

        MG_createCards: function (aGoals) {
          var oGrid = new sap.ui.layout.Grid({
            defaultSpan: "L6 M6 S12",
            hSpacing: 1,
            vSpacing: 1,
            width: "100%",
          });

          var fixedGoals = this._buildFixedFourGoals(aGoals || []);

          var isFinalSubmitted =
            this.getView()
              .getModel("viewModel")
              .getProperty("/isFinalSubmitted") === true;

          for (var i = 0; i < fixedGoals.length; i++) {
            var goal = fixedGoals[i];

            var oCard = new Card({
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

        FMG_onCategoryTilePress: function (oEvent) {
          this.getBusyDialog();
          var oTile = oEvent.getSource();
          var sTopic = null;

          var aCustom = oTile.getCustomData();

          for (var i = 0; i < aCustom.length; i++) {
            if (aCustom[i].getKey() === "topic") {
              sTopic = aCustom[i].getValue();
              break;
            }
          }

          var that = this;
          var oModel = this.getView().getModel("viewModel");

          var isEdit = oModel.getProperty("/isEditMode");

          if (!isEdit) {
            oModel.setProperty("/selectedCategory", sTopic);
          } else {
            // in edit mode ALWAYS keep existing category
            var existing = oModel.getProperty("/selectedCategory");

            if (!existing) {
              oModel.setProperty("/selectedCategory", sTopic);
            }
          }

          // reset question list first
          oModel.setProperty("/questionsList", []);

          this.ajaxReadWithJQuery("/GoalQuestions", {})
            .then(function (res) {
              var data = res.data || [];

              // STEP 1: load questions
              var filteredQuestions = data
                .filter((item) => item.Topic === sTopic)
                .map((item) => {
                  return { Question: item.Question };
                });

              oModel.setProperty("/questionsList", filteredQuestions);

              // STEP 2: check existing goal for SAME category
              return that.ajaxReadWithJQuery("/Goals", {});
            })
            .then(function (res) {
              var allGoals = res.data || [];
              var today = new Date();

              var existingGoal = allGoals.find(function (g) {
                var start = new Date(g.StartDate);
                var end = new Date(g.EndDate);

                return (
                  g.EmpID === "EMP001" &&
                  g.Topic === sTopic &&
                  today >= start &&
                  today <= end
                );
              });

              // STEP 3: if found â†’ auto fill
              if (existingGoal) {
                oModel.setProperty(
                  "/selectedQuestion",
                  existingGoal.Question || "",
                );
                oModel.setProperty(
                  "/description",
                  existingGoal.Description || "",
                );
                oModel.setProperty(
                  "/selectedQuarter",
                  existingGoal.Quarter || "",
                );
                oModel.setProperty("/editingGoalId", existingGoal.GoalId);
                oModel.setProperty("/isEditMode", true);
              } else {
                // STEP 4: if not found â†’ clear fields
                oModel.setProperty("/selectedQuestion", "");
                oModel.setProperty("/description", "");
                oModel.setProperty("/selectedQuarter", "Q1");
                oModel.setProperty("/editingGoalId", null);
                oModel.setProperty("/isEditMode", false);
              }
            })
            .catch(function (err) {
              console.log("Error:", err);
              MessageToast.show(that._getText("LoadDataFailed"));
            })
            .finally(() => {
              that.closeBusyDialog();
            });
        },

        FMG_onQuarterSelect: function (oEvent) {
          var oModel = this.getView().getModel("viewModel");

          var sQuarter = oEvent.getParameter("item").getKey();
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
              var today = new Date();

              var userGoals = allGoals.filter(function (g) {
                var start = new Date(g.StartDate);
                var end = new Date(g.EndDate);

                return g.EmpID === "EMP001" && today >= start && today <= end;
              });

              var conflictGoal = userGoals.find(function (g) {
                return g.Quarter === sQuarter;
              });

              if (conflictGoal) {
                if (conflictGoal.Topic === sCategory) {
                  MessageBox.error(
                    sQuarter +
                      " is already used for topic '" +
                      conflictGoal.Topic +
                      "'",
                  );
                } else {
                  MessageBox.error(
                    sQuarter +
                      " is already used for topic '" +
                      conflictGoal.Topic +
                      "'",
                  );
                }
                return;
              }

              // allowed
              oModel.setProperty("/selectedQuarter", sQuarter);
            })
            .catch(function () {
              MessageToast.show(this._getText("QuarterCheckError"));
            })
            .finally(() => {
              that.closeBusyDialog();
            });
        },

        FMG_onCancel: function () {
          var oModel = this.getView().getModel("viewModel");

          oModel.setProperty("/selectedCategory", "");
          oModel.setProperty("/selectedQuestion", "");
          oModel.setProperty("/description", "");
          oModel.setProperty("/selectedQuarter", "Q1");
          oModel.setProperty("/questionsList", []);

          //  RESET EDIT MODE (VERY IMPORTANT)
          oModel.setProperty("/isEditMode", false);
          oModel.setProperty("/editingGoalId", null);

          //  CLEAR VALIDATION
          this.byId("FMG_id_QuestionBox").setValueState("None");
          this.byId("FMG_id_DescriptionBox").setValueState("None");
          this.byId("FMG_id_QuestionBox").setValueStateText("");
          this.byId("FMG_id_DescriptionBox").setValueStateText("");

          if (this._oDialog) {
            this._oDialog.close();
          }
        },

        FMG_onSave: function () {
          var oModel = this.getView().getModel("viewModel");
          var isEdit = oModel.getProperty("/isEditMode");
          var editingId = oModel.getProperty("/editingGoalId");

          var that = this;

          var goal = {
            Topic: oModel.getProperty("/selectedCategory"),
            Question: oModel.getProperty("/selectedQuestion"),
            Description: oModel.getProperty("/description"),
            Quarter: oModel.getProperty("/selectedQuarter"),
            EmpID: "EMP001",
            EmpName: "Shyam Sunder",
            StartDate: "2026-04-01",
            EndDate: "2026-06-30",
            Status: "Pending",
          };

          // ================= VALIDATION =================
          if (!goal.Topic) {
            MessageToast.show(this._getText("SelectCategory"));
            return;
          }

          var oQ = this.byId("FMG_id_QuestionBox");
          if (!goal.Question) {
            oQ.setValueState("Error");
            oQ.setValueStateText(this._getText("SelectQuestion"));
            return;
          } else {
            oQ.setValueState("None");
          }

          var oD = this.byId("FMG_id_DescriptionBox");
          if (!goal.Description) {
            oD.setValueState("Error");
            oD.setValueStateText(this._getText("EnterDescription"));
            return;
          } else {
            oD.setValueState("None");
          }

          if (!goal.Quarter) {
            MessageToast.show(this._getText("SelectQuarterMsg"));
            return;
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

              var userGoals = allGoals.filter(function (g) {
                var start = new Date(g.StartDate);
                var end = new Date(g.EndDate);
                return g.EmpID === "EMP001" && today >= start && today <= end;
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
                    that._getText("QuarterConflict", [
                      goal.Quarter,
                      conflictGoal.Topic,
                    ]),
                  );
                  throw new Error("Duplicate quarter");
                }

                return that
                  .ajaxCreateWithJQuery("/Goals", { data: goal })
                  .then(function () {
                    MessageToast.show(that._getText("GoalCreated"));

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

          var payload = {
            data: {
              Topic: oModel.getProperty("/selectedCategory"),
              Question: oModel.getProperty("/selectedQuestion"),
              Description: oModel.getProperty("/description"),
              Quarter: oModel.getProperty("/selectedQuarter"),
              EmpId: "EMP001",
              EmpName: "Shyam Sunder",
              StartDate: "2026-04-01",
              EndDate: "2026-06-30",
              Status: "Pending",
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

      
        MG_loadTopics: function () {
          var that = this;

          this.getBusyDialog();
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
          var aFixed = [];
          // take only max 4 real goals
          var realGoals = (aGoals || []).slice(0, 4);
          // push real goals first
          for (var i = 0; i < realGoals.length; i++) {
            aFixed.push({
              ...realGoals[i],
              isEmpty: false,
            });
          }
          // fill remaining slots with empty placeholders
          while (aFixed.length < 4) {
            aFixed.push({
              GoalId: null,
              Topic: "No Goal Created",
              Quarter: "",
              Description: "You don't have goals yet",
              isEmpty: true,
            });
          }
          return aFixed;
        },
        onPressback: function () {
          this.getRouter().navTo("RouteTilePage")
        },
           onLogout() {
      this.getRouter().navTo("RouteLoginPage");
    },

        isQuarterDisabled: function (sQuarter) {
          var oModel = this.getView().getModel("viewModel");
          var used = oModel.getProperty("/usedQuarters") || {};

          var currentYear = new Date().getFullYear().toString();

          return !!(used[currentYear] && used[currentYear][sQuarter]);
        },

      
      },
    );
  },
);