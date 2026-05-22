sap.ui.define(
  [
    "sap/ui/integration/Extension",
    "sap/m/MessageToast",
    "sap/m/PDFViewer",
    "sap/ui/layout/form/SimpleForm",
    "sap/ui/unified/FileUploader"
  ],
  function (
    Extension,
    MessageToast,
    PDFViewer,
    SimpleForm,
    FileUploader,

  ) {
    "use strict";
    return Extension.extend("sap.kt.com.minihrsolution.cards.Extension", {

      init: function () {
        Extension.prototype.init.apply(this, arguments);

        this.attachAction(this._handleAction, this);
      },

      _fetchGoals: function (oFilter) {
        var that = this;
        var currentYear = new Date().getFullYear();

        oFilter = oFilter || {};
        return fetch("https://rest.kalpavrikshatechnologies.com/Goals", {
          method: "GET",
          headers: {
            name: "$2a$12$LC.eHGIEwcbEWhpi9gEA.umh8Psgnlva2aGfFlZLuMtPFjrMDwSui",
            password:
              "$2a$12$By8zKifvRcfxTbabZJ5ssOsheOLdAxA2p6/pdaNvv1xy1aHucPm0u",
          },
        })
          .then((res) => res.json())
          .then((res) => {
            var filtered = (res.data || []).filter((g) => {
              return new Date(g.StartDate).getFullYear() === currentYear;



            });
            if (oFilter.GoalId) {

              bMatch =
                bMatch &&
                String(g.GoalId) === String(oFilter.GoalId);

            }

            that._data = filtered;
            return filtered;
          });
      },
      getBusyDialog: function () {
        if (!this._pBusyDialog) {
          this._pBusyDialog = sap.ui.core.Fragment.load({
            name: "sap.kt.com.minihrsolution.fragment.BusyIndicator",
            controller: this,
          }).then(function (oDialog) {
            // ❌ REMOVE getView().addDependent
            return oDialog;
          });
        }
        return this._pBusyDialog;
      },

      showBusy: function () {
        this.getBusyDialog().then(
          function (oDialog) {
            this.oBusyDialog = oDialog;
            this.oBusyDialog.open();
          }.bind(this),
        );
      },

      hideBusy: function () {
        if (this.oBusyDialog) {
          this.oBusyDialog.close();
        }
      },
      getQuestionsWithActions: function () {
        var goalId = this.getCard().getParameters().GoalId;

        var params = this.getCard().getParameters();


        var currentYear = new Date().getFullYear();

        // HANDLE EMPTY CARD

        if (!goalId) {
          return Promise.resolve({
            GoalId: "",
            Question: "",
            Description: params.Description || "You don't have goals yet",
            Topic: params.Topic || "No Goal Created",
            Quarter: params.Quarter || "",

            EmpID: "",
            EmpName: "",
            StartDate: "",
            EndDate: "",
            Status: "",

            ScoresRemark: "",
            Score: "",
            HelpRequired: "",
            CreatedDate: new Date().toISOString().split("T")[0],

            editable1: false,
            editable2: true,
            isCurrentYear: true,
          });
        }

        // 2. ONLY IF REAL DATA → CALL BACKEND
        return this._fetchGoals().then(function (data) {
          var item =
            data.find((x) => String(x.GoalId) === String(goalId)) || {};

          var goalYear = item.StartDate
            ? new Date(item.StartDate).getFullYear()
            : null;


          return {
            GoalId: item.GoalId,
            Question: item.Question,
            Description: item.Description,
            Topic: item.Topic,
            Quarter: item.Quarter,

            EmpID: item.EmpID,
            EmpName: item.EmpName,
            StartDate: item.StartDate,
            EndDate: item.EndDate,
            Status: item.Status,

            ScoresRemark: item.ScoresRemark,
            Score: item.Score,
            HelpRequired: item.HelpRequired,

            SolutionDetails: item.SolutionDetails || "",

            AttachmentName: item.AttachmentName || "",
            AttachmentType: item.AttachmentType || "",
            AttachmentContent: item.AttachmentContent || "",

            CreatedDate: item.CreatedDate,

            editable1: false,
            editable2: true,
            isCurrentYear: goalYear === currentYear,
          };
        });
      },


      // =====================================================
      // COMMON VALIDATIONS
      // =====================================================

      // ================= REQUIRED FIELD =================
      _validateRequiredField: function (oControl, sMessage) {

        var sValue = "";

        if (oControl.getValue) {
          sValue = oControl.getValue();
        } else if (oControl.getSelectedKey) {
          sValue = oControl.getSelectedKey();
        }

        sValue = (sValue || "").trim();

        if (!sValue) {

          oControl.setValueState("Error");
          oControl.setValueStateText(sMessage);

          sap.m.MessageToast.show(sMessage);

          return false;
        }

        oControl.setValueState("None");

        return true;
      },

      // ================= SCORE VALIDATION =================
      _validateScore: function (oInput) {

        var sValue = oInput.getValue();

        var fValue = parseFloat(sValue);

        if (sValue === "") {

          oInput.setValueState("Error");

          oInput.setValueStateText("Score is required");

          sap.m.MessageToast.show("Please enter score");

          return false;
        }

        if (isNaN(fValue) || fValue < 0 || fValue > 5) {

          oInput.setValueState("Error");

          oInput.setValueStateText("Score must be between 0 and 5");

          sap.m.MessageToast.show("Score must be between 0 and 5");

          return false;
        }

        oInput.setValueState("None");

        return true;
      },

      // ================= COMMENTS / MANAGER REVIEW =================
      _validateComments: function (oTextArea) {

        var sValue = (oTextArea.getValue() || "").trim();

        var aWords = sValue.split(/\s+/).filter(Boolean);

        if (!sValue) {

          oTextArea.setValueState("Error");

          oTextArea.setValueStateText("Comments is required");

          sap.m.MessageToast.show("Please enter comments");

          return false;
        }

        // minimum words
        if (aWords.length < 3) {

          oTextArea.setValueState("Error");

          oTextArea.setValueStateText(
            "Minimum 3 words required"
          );

          sap.m.MessageToast.show(
            "Comments should contain minimum 3 words"
          );

          return false;
        }

        // maximum words
        if (aWords.length > 50) {

          oTextArea.setValueState("Error");

          oTextArea.setValueStateText(
            "Maximum 50 words allowed"
          );

          sap.m.MessageToast.show(
            "Comments cannot exceed 50 words"
          );

          return false;
        }

        oTextArea.setValueState("None");

        return true;
      },

      // ================= DESCRIPTION VALIDATION =================
      _validateDescription: function (oTextArea) {

        var sValue = (oTextArea.getValue() || "").trim();

        var aWords = sValue.split(/\s+/).filter(Boolean);

        if (!sValue) {

          oTextArea.setValueState("Error");

          oTextArea.setValueStateText(
            "Data is required"
          );

          sap.m.MessageToast.show(
            "Please enter data"
          );

          return false;
        }

        // minimum words
        if (aWords.length < 5) {

          oTextArea.setValueState("Error");

          oTextArea.setValueStateText(
            "Minimum 5 words required"
          );

          sap.m.MessageToast.show(
            "Data should contain minimum 5 words"
          );

          return false;
        }

        // maximum words
        if (aWords.length > 50) {

          oTextArea.setValueState("Error");

          oTextArea.setValueStateText(
            "Maximum 50 words allowed"
          );

          sap.m.MessageToast.show(
            "Data cannot exceed 50 words"
          );

          return false;
        }

        oTextArea.setValueState("None");

        return true;
      },

      // ================= QUESTION VALIDATION =================
      _validateQuestion: function (oSelect) {

        var sKey = oSelect.getSelectedKey();

        if (!sKey) {

          oSelect.setValueState("Error");

          oSelect.setValueStateText(
            "Please select question"
          );

          sap.m.MessageToast.show(
            "Please select question"
          );

          return false;
        }

        oSelect.setValueState("None");

        return true;
      },

      _openApprovalDialog: function (sType, sGoalId) {
        var that = this;

        this._fetchGoals().then(function (aGoals) {
          var oGoal = aGoals.find(function (g) {
            return String(g.GoalId) === String(sGoalId);
          });

          // ================= STATUS CHECK =================

          var bShowScore =
            oGoal.Status === "Goal Submitted" && sType === "approve";

          // ================= CONTROLS =================
          // score validation
          var oScoreInput = new sap.m.Input({
            value: "",
            type: "Number",
            placeholder: "Enter Score (0 - 5)",

            liveChange: function (oEvent) {
              var sValue = oEvent.getParameter("value");

              // remove invalid characters
              sValue = sValue.replace(/[^0-9.]/g, "");

              // allow only one decimal
              var aParts = sValue.split(".");
              if (aParts.length > 2) {
                sValue = aParts[0] + "." + aParts[1];
              }

              var fValue = parseFloat(sValue);

              // max score 5
              if (fValue > 5) {
                sValue = "5";
                sap.m.MessageToast.show("Score cannot be more than 5");
              }

              // min score 0
              if (fValue < 0) {
                sValue = "0";
              }

              oEvent.getSource().setValue(sValue);
            },
          });

          // feedback validation
          var iMaxWords = 50;

          var oCounterText = new sap.m.Text({
            text: "Words: 0/50",
          });

          var oFeedbackInput = new sap.m.TextArea({
            value: "",
            rows: 5,
            width: "100%",
            placeholder: "Enter Comments",

            liveChange: function (oEvent) {

              this.setValueState("None");

              var sValue = oEvent.getParameter("value") || "";

              var aWords = sValue.trim().split(/\s+/).filter(Boolean);

              if (aWords.length > iMaxWords) {

                aWords = aWords.slice(0, iMaxWords);

                sValue = aWords.join(" ");

                oEvent.getSource().setValue(sValue);

                sap.m.MessageToast.show(
                  "Maximum 50 words allowed"
                );
              }

              oCounterText.setText(
                "Words: " +
                aWords.length +
                "/" +
                iMaxWords
              );
            }
          });

          // ================= DIALOG ITEMS =================

          var aItems = [];

          // SHOW SCORE ONLY AFTER GOAL SUBMITTED

          if (bShowScore) {
            aItems.push(
              new sap.m.Label({
                text: "Score",
                required: true,
              }),
            );

            aItems.push(oScoreInput);
          }

          // ALWAYS SHOW FEEDBACK

          aItems.push(
            new sap.m.Label({
              text: "Comments",
              required: true,
            }).addStyleClass("sapUiSmallMarginTop"),
          );

          aItems.push(oFeedbackInput);
          aItems.push(oCounterText);

          // ================= DIALOG =================

          that._oApprovalDialog = new sap.m.Dialog({
            title: sType === "approve" ? "Approve Goal" : "Reject Goal",

            contentWidth: "400px",

            content: [
              new sap.m.VBox({
                items: aItems,
              }).addStyleClass("sapUiSmallMargin"),
            ],

            beginButton: new sap.m.Button({
              text: "Submit",
              press: async function () {

                var sScore = oScoreInput.getValue();

                var sFeedback = oFeedbackInput.getValue();

                // ================= SCORE VALIDATION =================

                if (bShowScore) {

                  if (!that._validateScore(oScoreInput)) {
                    return;
                  }
                }

                // ================= FEEDBACK VALIDATION =================

                if (!that._validateDescription(oFeedbackInput)) {
                  return;
                }

                that.showBusy();

                try {

                  await that._updateGoalApproval(
                    sGoalId,
                    sType,
                    sScore,
                    sFeedback
                  );

                  sap.m.MessageToast.show(
                    sType === "approve"
                      ? "Goal Approved Successfully"
                      : "Goal Rejected Successfully"
                  );

                  that._oApprovalDialog.close();

                  that.getCard().refreshData();

                } catch (e) {

                  that.hideBusy();
                  sap.m.MessageBox.error("Failed to update goal");
                }
              }
            }),


            endButton: new sap.m.Button({
              text: "Cancel",

              press: function () {
                that._oApprovalDialog.close();
                that._oApprovalDialog.destroy();

                that._oApprovalDialog = null;
              },
            }),

            afterClose: function () {
              that._oApprovalDialog.destroy();

              that._oApprovalDialog = null;
            },
          });

          that._oApprovalDialog.open();
        });
      },

      _updateGoalApproval: function (sGoalId, sType, sScore, sFeedback) {
        var that = this;

        return this._fetchGoals().then(function (aGoals) {
          var oGoal = aGoals.find(function (g) {
            return String(g.GoalId) === String(sGoalId);
          });

          if (!oGoal) {
            throw new Error("Goal not found");
          }

          var sStatus = "";

          if (oGoal.Status === "Goal Submitted") {
            sStatus =
              sType === "approve" ? "Approved Solution" : "Rejected Solution";
          } else {
            sStatus = sType === "approve" ? "Approved" : "Rejected";
          }

          var payload = {
            filters: {
              GoalId: sGoalId,
            },

            data: {
              GoalId: sGoalId,
              EmpID: oGoal.EmpID,
              EmpName: oGoal.EmpName,

              Topic: oGoal.Topic,
              Quarter: oGoal.Quarter,

              StartDate: oGoal.StartDate,
              EndDate: oGoal.EndDate,

              Description: oGoal.Description,

              Status: sStatus,

              ScoresRemark: sFeedback,
              Score: sScore,

              HelpRequired: oGoal.HelpRequired || "",
              SolutionDetails: oGoal.SolutionDetails || "",

              CreatedDate: oGoal.CreatedDate,
            },
          };

          return new Promise(function (resolve, reject) {
            that.showBusy();
            $.ajax({
              url: "https://rest.kalpavrikshatechnologies.com/Goals",

              method: "PUT",

              data: JSON.stringify(payload),

              headers: {
                "Content-Type": "application/json",

                name: "$2a$12$LC.eHGIEwcbEWhpi9gEA.umh8Psgnlva2aGfFlZLuMtPFjrMDwSui",

                password:
                  "$2a$12$By8zKifvRcfxTbabZJ5ssOsheOLdAxA2p6/pdaNvv1xy1aHucPm0u",
              },

              success: function () {
                that.hideBusy();
                var oCard = that.getCard();

                // FORCE FULL CARD REFRESH
                oCard.refreshData();

                MessageToast.show(
                  sType === "approve"
                    ? "Goal Approved Successfully"
                    : "Goal Rejected Successfully",
                );

                that._oApprovalDialog.close();

                resolve();
              },

              error: function (err) {
                that.hideBusy();
                reject(err);
              },
            });
          });
        });
      },



      _openEditDialog: function (oData) {
        var that = this;

        // ================= FETCH QUESTIONS DYNAMICALLY =================
        that.showBusy();
        fetch("https://rest.kalpavrikshatechnologies.com/GoalQuestions", {
          method: "GET",
          headers: {
            name: "$2a$12$LC.eHGIEwcbEWhpi9gEA.umh8Psgnlva2aGfFlZLuMtPFjrMDwSui",

            password:
              "$2a$12$By8zKifvRcfxTbabZJ5ssOsheOLdAxA2p6/pdaNvv1xy1aHucPm0u",
          },
        })
          .then((res) => res.json())
          .then(function (res) {
            // ================= FILTER SAME TOPIC =================
            that.hideBusy();
            var aQuestions = (res.data || []).filter(function (item) {
              return item.Topic === oData.Topic;
            });

            // ================= QUESTION DROPDOWN ITEMS =================

            var aItems = aQuestions.map(function (item) {
              return new sap.ui.core.Item({
                key: item.Question,
                text: item.Question,
              });
            });

            // ================= QUESTION SELECT =================

            var oQuestionSelect = new sap.m.Select({
              width: "100%",

              selectedKey: oData.Question,

              items: aItems,
            });

            // ================= DESCRIPTION =================

            var oDescriptionArea = new sap.m.TextArea({
              value: oData.Description,
              rows: 5,
              width: "100%",
              placeholder: "Enter Description",

              liveChange: function (oEvent) {

                this.setValueState("None");

                var sValue = oEvent.getParameter("value") || "";

                var aWords = sValue.trim().split(/\s+/).filter(Boolean);

                if (aWords.length > 50) {

                  aWords = aWords.slice(0, 50);

                  sValue = aWords.join(" ");

                  oEvent.getSource().setValue(sValue);

                  sap.m.MessageToast.show(
                    "Maximum 50 words allowed"
                  );
                }
              }
            });

            // ================= DIALOG =================

            var oDialog = new sap.m.Dialog({
              title: "Edit Goal",

              contentWidth: "500px",

              content: [
                new sap.m.VBox({
                  items: [
                    new sap.m.Label({
                      text: "Topic",
                    }),

                    new sap.m.Text({
                      text: oData.Topic,
                    }),

                    new sap.m.Label({
                      text: "Quarter",
                    }).addStyleClass("sapUiSmallMarginTop"),

                    new sap.m.Text({
                      text: oData.Quarter,
                    }),

                    new sap.m.Label({
                      text: "Question",
                    }).addStyleClass("sapUiSmallMarginTop"),

                    oQuestionSelect,

                    new sap.m.Label({
                      text: "Description",
                    }).addStyleClass("sapUiSmallMarginTop"),

                    oDescriptionArea,
                  ],
                }).addStyleClass("sapUiMediumMargin"),
              ],

              beginButton: new sap.m.Button({
                text: "Save",

                press: function () {

                  var sQuestion =
                    oQuestionSelect.getSelectedKey();

                  var sDescription =
                    oDescriptionArea.getValue();

                  // ================= VALIDATION =================

                  if (!that._validateQuestion(oQuestionSelect)) {
                    return;
                  }

                  if (!that._validateDescription(oDescriptionArea)) {

                    MessageToast.show(
                      "Please enter description"
                    );

                    return;
                  }

                  // ================= CONFIRMATION =================

                  sap.m.MessageBox.confirm(

                    "Are you sure you want to save changes?",

                    {
                      title: "Confirmation",

                      actions: [
                        sap.m.MessageBox.Action.OK,
                        sap.m.MessageBox.Action.CANCEL
                      ],

                      emphasizedAction:
                        sap.m.MessageBox.Action.OK,

                      onClose: function (oAction) {

                        if (
                          oAction !==
                          sap.m.MessageBox.Action.OK
                        ) {
                          return;
                        }

                        // ================= PAYLOAD =================

                        var payload = {

                          filters: {
                            GoalId: oData.GoalId
                          },

                          data: {
                            GoalId: oData.GoalId,
                            EmpID: oData.EmpID,
                            EmpName: oData.EmpName,
                            Topic: oData.Topic,
                            Quarter: oData.Quarter,
                            StartDate: oData.StartDate,
                            EndDate: oData.EndDate,
                            Question: sQuestion,
                            Description: sDescription,

                            Status: "Submitted",
                            Score: "0",
                            ScoresRemark: "",

                            HelpRequired:
                              oData.HelpRequired || "",

                            SolutionDetails:
                              oData.SolutionDetails || "",

                            CreatedDate:
                              oData.CreatedDate
                          }
                        };

                        // ================= UPDATE API =================

                        that.showBusy();

                        $.ajax({

                          url:
                            "https://rest.kalpavrikshatechnologies.com/Goals",

                          method: "PUT",

                          data: JSON.stringify(payload),

                          headers: {

                            "Content-Type":
                              "application/json",

                            name:
                              "$2a$12$LC.eHGIEwcbEWhpi9gEA.umh8Psgnlva2aGfFlZLuMtPFjrMDwSui",
                            password:
                              "$2a$12$By8zKifvRcfxTbabZJ5ssOsheOLdAxA2p6/pdaNvv1xy1aHucPm0u"
                          },

                          success: function () {

                            that.hideBusy();

                            MessageToast.show(
                              "Goal Updated Successfully"
                            );

                            oDialog.close();
                            that.getCard().refreshData();
                          },

                          error: function () {

                            that.hideBusy();

                            MessageToast.show(
                              "Update Failed"
                            );
                          }
                        });
                      }
                    }
                  );
                }
              }),

              endButton: new sap.m.Button({
                text: "Cancel",

                press: function () {
                  oDialog.close();
                },
              }),

              afterClose: function () {
                oDialog.destroy();
              },
            });

            oDialog.open();
          });
      },

      _openSolutionDialog: function (sGoalId) {
        var that = this;

        var oSolutionInput = new sap.m.TextArea({
          rows: 6,
          width: "100%",
          placeholder: "Enter solution details for this goal...",

          liveChange: function (oEvent) {

            this.setValueState("None");

            var sValue = oEvent.getParameter("value") || "";

            var aWords = sValue.trim().split(/\s+/).filter(Boolean);

            if (aWords.length > 50) {

              aWords = aWords.slice(0, 50);

              sValue = aWords.join(" ");

              oEvent.getSource().setValue(sValue);

              sap.m.MessageToast.show(
                "Maximum 50 words allowed"
              );
            }
          }
        });

        // PDF Upload
        var oFileUploader = new FileUploader({
          width: "100%",
          fileType: ["pdf"],
          placeholder: "Attach PDF File",
          buttonText: "Choose PDF",

          change: function (oEvent) {

            var oUploader = oEvent.getSource();

            var oFile = oEvent.getParameter("files")[0];

            // ================= RESET ERROR =================

            oUploader.setValueState(sap.ui.core.ValueState.None);

            oUploader.setValueStateText("");

            // ================= VALIDATE PDF =================

            var sFileName = oFile.name.toLowerCase();

            var bIsPdf =
              oFile.type === "application/pdf" ||
              sFileName.endsWith(".pdf");

            if (!bIsPdf) {

              oUploader.setValueState(
                sap.ui.core.ValueState.Error
              );

              oUploader.setValueStateText(
                "Only PDF files are allowed"
              );

              sap.m.MessageToast.show(
                "Please upload valid PDF"
              );

              return;
            }
            var iMaxSize = 2 * 1024 * 1024;

            if (oFile.size > iMaxSize) {

              oUploader.setValueState(
                sap.ui.core.ValueState.Error
              );

              oUploader.setValueStateText(
                "PDF size should not exceed 2 MB"
              );

              sap.m.MessageToast.show(
                "Maximum allowed file size is 2 MB"
              );

              oUploader.clear();

              return;
            }

            // ================= SUCCESS =================

            oUploader.setValueState(
              sap.ui.core.ValueState.None
            );

            oUploader.setValueStateText("");
          }
        });
        this._oSolutionDialog = new sap.m.Dialog({
          title: "Submit Solution Details",

          contentWidth: "400px",

          content: [
            new sap.m.VBox({
              items: [
                new sap.m.Label({
                  text: "Solution Details",
                  required: true,
                }),

                oSolutionInput,

                new sap.m.Label({
                  text: "Attach PDF",
                }).addStyleClass("sapUiSmallMarginTop"),

                oFileUploader,
              ],
            }).addStyleClass("sapUiSmallMargin"),
          ],

          beginButton: new sap.m.Button({
            text: "Save",

            press: function () {
              var sSolution = oSolutionInput.getValue();

              // ================= VALIDATE SOLUTION =================

              if (!that._validateDescription(oSolutionInput)) {
                sap.m.MessageToast.show("Please enter solution details");

                return;
              }

              // ================= GET FILE =================

              var oFile = oFileUploader.getDomRef("fu").files[0];
              if (!oFile) {

                oFileUploader.setValueState(
                  sap.ui.core.ValueState.Error
                );

                oFileUploader.setValueStateText(
                  "Please upload PDF file"
                );

                sap.m.MessageToast.show(
                  "Please select a PDF file"
                );

                return;
              }

              // CLEAR ERROR
              oFileUploader.setValueState(
                sap.ui.core.ValueState.None
              );

              oFileUploader.setValueStateText("");
              var reader = new FileReader();

              reader.onload = function (e) {
                var sBase64 = e.target.result.split(",")[1];

                that._saveSolution(
                  sGoalId,
                  sSolution,
                  oFile.name,
                  oFile.type,
                  sBase64,
                );
              };

              reader.readAsDataURL(oFile);
            },
          }),

          endButton: new sap.m.Button({
            text: "Cancel",

            press: function () {
              that._oSolutionDialog.close();
            },
          }),

          afterClose: function () {
            that._oSolutionDialog.destroy();

            that._oSolutionDialog = null;
          },
        });

        this._oSolutionDialog.open();
      },

      _saveSolution: function (
        sGoalId,
        sSolution,
        sAttachmentName,
        sAttachmentType,
        sAttachmentContent,
      ) {
        var that = this;

        return this._fetchGoals().then(function (aGoals) {
          var oGoal = aGoals.find((g) => String(g.GoalId) === String(sGoalId));

          if (!oGoal) {
            throw new Error("Goal not found");
          }
          var sYear =
            new Date().getFullYear();

          var sCustomFileName =
            "solution_" +
            oGoal.Quarter +
            "_" +
            sYear +
            ".pdf";

          var payload = {
            filters: {
              GoalId: sGoalId,
            },

            data: {
              GoalId: sGoalId,
              EmpID: oGoal.EmpID,
              EmpName: oGoal.EmpName,

              Topic: oGoal.Topic,
              Quarter: oGoal.Quarter,

              StartDate: oGoal.StartDate,
              EndDate: oGoal.EndDate,

              Question: oGoal.Question,
              Description: oGoal.Description,

              Status: "Goal Submitted",

              ScoresRemark: sSolution || "",
              Score: oGoal.Score || "0",

              HelpRequired: oGoal.HelpRequired || "",


              AttachmentName: sCustomFileName,
              AttachmentType: sAttachmentType,
              AttachmentContent: sAttachmentContent,

              CreatedDate: oGoal.CreatedDate,
            },
          };

          that.showBusy();
          $.ajax({
            url: "https://rest.kalpavrikshatechnologies.com/Goals",
            method: "PUT",
            data: JSON.stringify(payload),
            headers: {
              "Content-Type": "application/json",
              name: "$2a$12$LC.eHGIEwcbEWhpi9gEA.umh8Psgnlva2aGfFlZLuMtPFjrMDwSui",
              password:
                "$2a$12$By8zKifvRcfxTbabZJ5ssOsheOLdAxA2p6/pdaNvv1xy1aHucPm0u",
            },

            success: function () {
              that.hideBusy();
              var oCard = that.getCard();
              var oModel = oCard.getModel();
              var oData = oModel.getData();

              // update locally
              oData.HelpRequired = oData.HelpRequired || "";
              oData.SolutionDetails = sSolution;
              oData.AttachmentName = sCustomFileName;
              oData.AttachmentType = sAttachmentType;
              oData.AttachmentContent = sAttachmentContent;

              // IMPORTANT
              oData.Status = "Goal Submitted";

              oModel.setData(oData);
              oModel.refresh(true);

              sap.m.MessageToast.show("Goal submitted successfully");

              that._oSolutionDialog.close();
            },

            error: function (err) {
              that.hideBusy();
              sap.m.MessageToast.show("Failed to save solution");
            },
          });
        });
      },
      formatDate: function (sDate) {

        if (!sDate) {
          return "-";
        }

        var oDate = new Date(sDate);

        return oDate.toLocaleDateString(
          "en-GB"
        );

      },
      _openViewDetailsDialog: function (oData) {

        // var oGoal = {};

        // fetch(
        //     "https://rest.kalpavrikshatechnologies.com/Goals?GoalId=" +
        //     encodeURIComponent(oData.GoalId),

        //     {
        //         method: "GET",

        //         headers: {

        //             name:
        //                 "$2a$12$LC.eHGIEwcbEWhpi9gEA.umh8Psgnlva2aGfFlZLuMtPFjrMDwSui",

        //             password:
        //                 "$2a$12$By8zKifvRcfxTbabZJ5ssOsheOLdAxA2p6/pdaNvv1xy1aHucPm0u"

        //         }

        //     }
        // )

        // .then((res) => res.json())

        // .then((res) => {

        //     oGoal = res.data?.[0] || {};

        // });

        var sStatus = oData.Status || "-";

        var sScore =
          Number(oData.Score) > 0
            ? "⭐".repeat(Number(oData.Score))
            : "-";

        var sState = sap.ui.core.ValueState.None;

        switch ((sStatus || "").toLowerCase()) {
          case "approved":
          case "completed":
          case "success":
            sState = sap.ui.core.ValueState.Success;
            break;

          case "pending":
          case "in progress":
          case "submitted":
            sState = sap.ui.core.ValueState.Information;
            break;

          case "rejected":
          case "failed":
            sState = sap.ui.core.ValueState.Error;
            break;

          default:
            sState = sap.ui.core.ValueState.None;
        }

        // ================= PDF URL =================

        var sPdfUrl = "";


        if (oData.AttachmentContent) {
          var sBase64 = oData.AttachmentContent;

          // HANDLE BUFFER OBJECT
          if (
            typeof sBase64 === "object" &&
            sBase64.type === "Buffer" &&
            Array.isArray(sBase64.data)
          ) {
            let binary = "";

            for (let i = 0; i < sBase64.data.length; i++) {
              binary += String.fromCharCode(sBase64.data[i]);
            }

            sBase64 = btoa(binary);
          }

          sBase64 = String(sBase64)
            .replace(/^data:application\/pdf;base64,/, "")
            .replace(/\s/g, "");

          sPdfUrl = "data:application/pdf;base64," + sBase64;
        }

        var oDialog = new sap.m.Dialog({
          title: "Goal Details",

          contentWidth: "1100px",
          contentHeight: "750px",

          horizontalScrolling: false,
          verticalScrolling: false,

          draggable: true,
          resizable: true,

          stretchOnPhone: true,

          content: [
            new sap.uxap.ObjectPageLayout({
              useIconTabBar: false,
              showAnchorBar: true,
              upperCaseAnchorBar: false,
              preserveHeaderStateOnScroll: true,
              showTitleInHeaderContent: true,
              alwaysShowContentHeader: false,

              // ================= HEADER =================

              headerTitle: new sap.uxap.ObjectPageDynamicHeaderTitle({
                expandedHeading: new sap.m.VBox({
                  items: [
                    new sap.m.Title({
                      text: oData.Topic || "No Topic",
                      level: "H2",
                    }).addStyleClass("sapUiSmallMarginTop"),

                    new sap.m.HBox({
                      wrap: "Wrap",

                      items: [
                        new sap.m.ObjectIdentifier({
                          title: "Quarter",
                          text: oData.Quarter || "-",
                        }).addStyleClass("sapUiMediumMarginEnd whiteLabel"),

                        new sap.m.ObjectIdentifier({
                          title: "Status",
                          text: sStatus,
                          state: sState,
                        }).addStyleClass("sapUiMediumMarginEnd whiteLabel"),

                        new sap.m.ObjectIdentifier({
                          title: "Score",
                          text: sScore,
                        }).addStyleClass("sapUiMediumMarginEnd whiteLabel"),

                        new sap.m.ObjectIdentifier({
                          title: "Start Date",
                          text: oData.StartDate
                            ? new Date(oData.StartDate).toLocaleDateString("en-GB")
                            : "-"
                        }).addStyleClass("sapUiMediumMarginEnd whiteLabel"),

                        new sap.m.ObjectIdentifier({
                          title: "End Date",
                          text: oData.EndDate
                            ? new Date(oData.EndDate).toLocaleDateString("en-GB")
                            : "-"
                        }).addStyleClass("sapUiMediumMarginEnd whiteLabel"),
                        new sap.m.ObjectIdentifier({
                          title: "Question",
                          text: oData.Question || "-",
                        }).addStyleClass("sapUiMediumMarginEnd whiteLabel"),
                      ],
                    }).addStyleClass("sapUiSmallMarginTop"),
                  ],
                }).addStyleClass("sapUiSmallMarginBottom"),

                snappedHeading: new sap.m.Title({
                  title: "Topic",
                  text: oData.Topic || "No Topic",
                  level: "H4",
                }),
              }),

              // ================= SECTIONS =================

              sections: [

                // =================================================
                // ATTACHMENT REVIEW
                // =================================================



                new sap.uxap.ObjectPageSection({

                  title: "Goal Description",

                  subSections: [
                    new sap.uxap.ObjectPageSubSection({
                      blocks: [
                        new sap.ui.layout.Grid({
                          defaultSpan: "L6 M6 S12",
                          width: "100%",

                          content: [

                            new sap.m.VBox({

                              width: "100%",

                              fitContainer: true,

                              renderType: "Bare",

                              alignItems: "Stretch",

                              items: [

                                new sap.m.VBox({

                                  width: "100%",

                                  fitContainer: true,

                                  renderType: "Bare",

                                  items: [

                                    new sap.m.Text({

                                      text: oData.Description || "-",

                                      wrapping: true,

                                      width: "100%"

                                    })
                                  ]
                                })
                              ]
                            })
                          ]
                        }),
                      ],
                    }),
                  ],

                }),
                new sap.uxap.ObjectPageSection({

                  title: "Solution Details",

                  subSections: [
                    new sap.uxap.ObjectPageSubSection({
                      blocks: [
                        new sap.ui.layout.Grid({
                          defaultSpan: "L6 M6 S12",
                          width: "100%",

                          content: [

                            new sap.m.VBox({
                              width: "100%",

                              items: [

                                new sap.m.ObjectIdentifier({
                                  text: oData.SolutionDetails || "-",
                                }).addStyleClass("sapUiSmallMarginBottom"),
                              ],
                            }).addStyleClass("sapUiResponsiveContentPadding"),
                          ],
                        }),
                      ],
                    }),
                  ],


                }),
                new sap.uxap.ObjectPageSection({

                  title: "Manager Review",

                  subSections: [
                    new sap.uxap.ObjectPageSubSection({
                      blocks: [
                        new sap.ui.layout.Grid({
                          defaultSpan: "L6 M6 S12",
                          width: "100%",

                          content: [

                            new sap.m.VBox({
                              width: "100%",

                              items: [

                                new sap.m.ObjectIdentifier({
                                  text: oData.ScoresRemark || "-",
                                }).addStyleClass("sapUiSmallMarginBottom"),
                              ],
                            }).addStyleClass("sapUiResponsiveContentPadding"),
                          ],
                        }),
                      ],
                    }),
                  ],

                }),


                new sap.uxap.ObjectPageSection({

                  title: "Attachments",

                  subSections: [

                    new sap.uxap.ObjectPageSubSection({

                      mode: "Expanded",

                      blocks: [

                        (function () {

                          // =========================
                          // ATTACHMENT CONTAINER
                          // =========================

                          var oAttachmentBox =
                            new sap.m.VBox({

                              width: "100%",

                              height: "100%",
                              fitContainer: true,


                            });

                          // =========================
                          // ATTACHMENT EXISTS
                          // =========================

                          if (oData.AttachmentContent) {

                            var sBase64 =
                              String(
                                oData.AttachmentContent
                              )

                                .replace(
                                  /^data:application\/pdf;base64,/,
                                  ""
                                )

                                .replace(/\s/g, "");

                            // HANDLE REFRESH ISSUE

                            if (
                              sBase64.startsWith("SlZCR")
                            ) {

                              sBase64 =
                                atob(sBase64);
                            }

                            var sPdfUrl =
                              "data:application/pdf;base64," +
                              sBase64;

                            oAttachmentBox.addItem(

                              new sap.ui.core.HTML({

                                preferDOM: true,

                                content: `

                                    <iframe
                                        src="${sPdfUrl}"
                                        width="100%"
                                        height="650px"
                                        style="
                                            border:none;
                                            border-radius:12px;
                                            background:white;
                                        ">
                                    </iframe>

                                `
                              })
                            );
                          }

                          // =========================
                          // ATTACHMENT MISSING
                          // =========================

                          else {

                            oAttachmentBox.addItem(


                            );

                            // =========================
                            // FETCH ATTACHMENT
                            // =========================

                            if (oData.GoalId) {

                              $.ajax({

                                url:
                                  "https://rest.kalpavrikshatechnologies.com/GoalsAttachment?GoalId=" +
                                  oData.GoalId,

                                method: "GET",

                                headers: {

                                  "Content-Type":
                                    "application/json",

                                  name:
                                    "$2a$12$LC.eHGIEwcbEWhpi9gEA.umh8Psgnlva2aGfFlZLuMtPFjrMDwSui",

                                  password:
                                    "$2a$12$By8zKifvRcfxTbabZJ5ssOsheOLdAxA2p6/pdaNvv1xy1aHucPm0u"
                                },

                                success: function (result) {

                                  oAttachmentBox.removeAllItems();

                                  var attachment =
                                    result?.data?.[0];

                                  // =========================
                                  // ATTACHMENT FOUND
                                  // =========================

                                  if (

                                    attachment &&

                                    attachment.AttachmentContent

                                  ) {

                                    let sBase64 =
                                      String(
                                        attachment.AttachmentContent
                                      )

                                        .replace(
                                          /^data:application\/pdf;base64,/,
                                          ""
                                        )

                                        .replace(/\s/g, "");

                                    // HANDLE REFRESH ISSUE

                                    if (
                                      sBase64.startsWith("SlZCR")
                                    ) {

                                      sBase64 =
                                        atob(sBase64);
                                    }

                                    const sPdfUrl =
                                      "data:application/pdf;base64," +
                                      sBase64;

                                    oAttachmentBox.addItem(

                                      new sap.ui.core.HTML({

                                        preferDOM: true,

                                        content: `

                                                    <iframe
                                                        src="${sPdfUrl}"
                                                        width="100%"
                                                        height="650px"
                                                        style="
                                                            border:none;
                                                            border-radius:12px;
                                                            background:white;
                                                        ">
                                                    </iframe>

                                                `
                                      })
                                    );
                                  }

                                  // =========================
                                  // NO ATTACHMENT
                                  // =========================

                                  else {

                                    oAttachmentBox.addItem(

                                      new sap.m.VBox({

                                        width: "100%",

                                        height: "650px",

                                        alignItems: "Center",

                                        justifyContent: "Center",

                                        items: [

                                          new sap.ui.core.Icon({

                                            src:
                                              "sap-icon://document-text",

                                            size: "4rem"

                                          }).addStyleClass(
                                            "sapUiMediumMarginBottom"
                                          ),

                                          new sap.m.Title({

                                            text:
                                              "No Document Available",

                                            level: "H4"

                                          }),

                                          new sap.m.Text({

                                            text:
                                              "The supporting PDF document has not been uploaded for this goal yet.",

                                            textAlign: "Center"

                                          }).addStyleClass(
                                            "sapUiSmallMarginTop"
                                          )
                                        ]
                                      }).addStyleClass(
                                        "sapUiResponsiveContentPadding"
                                      )
                                    );
                                  }

                                }.bind(this),

                                error: function () {

                                  oAttachmentBox.removeAllItems();

                                  oAttachmentBox.addItem(

                                    new sap.m.Text({

                                      text:
                                        "Failed to load attachment"
                                    })
                                  );
                                }
                              });
                            }
                          }

                          return oAttachmentBox;

                        }).call(this)

                      ]
                    })
                  ]
                }),
                new sap.uxap.ObjectPageSection({

                  title: "Goal Comments",

                  subSections: [

                    new sap.uxap.ObjectPageSubSection({

                      blocks: [

                        (function () {

                          // =========================
                          // COMMENT CONTAINER
                          // =========================

                          var oCommentBox = new sap.m.VBox({
                            width: "100%"
                          });

                          // =========================
                          // LOADING
                          // =========================

                          oCommentBox.addItem(

                            new sap.m.BusyIndicator({
                              size: "2rem"
                            })

                          );

                          // =========================
                          // FETCH GOAL DETAILS
                          // =========================

                          fetch(

                            "https://rest.kalpavrikshatechnologies.com/Goals?GoalId=" +
                            encodeURIComponent(oData.GoalId),

                            {

                              method: "GET",

                              headers: {

                                "Content-Type": "application/json",

                                name:
                                  "$2a$12$LC.eHGIEwcbEWhpi9gEA.umh8Psgnlva2aGfFlZLuMtPFjrMDwSui",

                                password:
                                  "$2a$12$By8zKifvRcfxTbabZJ5ssOsheOLdAxA2p6/pdaNvv1xy1aHucPm0u"

                              }

                            }

                          )
                            .then(function (res) {
                              return res.json();
                            })
                            .then(function (res) {
                              oCommentBox.removeAllItems();
                              var oGoal =
                                (res.data && res.data[0]) || {};
                              var aComments =
                                oGoal.comments || [];
                              // =========================
                              // NO COMMENTS
                              // =========================

                              if (aComments.length === 0) {

                                oCommentBox.addItem(

                                  new sap.m.Text({

                                    text: "No Comments Available"

                                  })

                                );

                                return;
                              }

                              // =========================
                              // TIMELINE
                              // =========================

                              var oTimeline =
                                new sap.suite.ui.commons.Timeline({

                                  width: "100%",

                                  showHeaderBar: false,

                                  showHeader: false,

                                  enableBusyIndicator: false,

                                  sortOldestFirst: false,

                                  enableDoubleSided: false

                                });

                              aComments.forEach(function (oComment) {

                                oTimeline.addContent(

                                  new sap.suite.ui.commons.TimelineItem({

                                    dateTime:
                                      oComment.CommentDateTime
                                        ? new Date(
                                          oComment.CommentDateTime
                                        ).toLocaleString("en-GB")
                                        : "-",

                                    title:
                                      oComment.CommentedBy || "Anonymous",

                                    text:
                                      oComment.Comment || "No Comment",

                                    userNameClickable: false,

                                    icon: "sap-icon://comment"

                                  })

                                );

                              });

                              oCommentBox.addItem(oTimeline);

                            })

                            .catch(function (err) {



                              oCommentBox.removeAllItems();

                              oCommentBox.addItem(

                                new sap.m.Text({

                                  text:
                                    "Failed to load comments"

                                })

                              );

                            });

                          return oCommentBox;

                        })()

                      ]

                    })

                  ]

                })

              ],
            }),
          ],

          endButton: new sap.m.Button({
            text: "Close",

            press: function () {
              oDialog.close();
            },
          }),

          afterClose: function () {
            oDialog.destroy();
          },
        });

        oDialog.open();
      },
      // No use of this function but if you need you can use for better understanding
      _onPressAttachment: async function (oEvent, id) {

        this.showBusy();

        try {

          var oData = null;

          var sGoalId = null;

          // =========================
          // EVENT OBJECT
          // =========================

          if (
            oEvent &&
            typeof oEvent.getSource === "function"
          ) {

            var oContext =
              oEvent.getSource()
                .getBindingContext();

            oData =
              oContext.getObject();

            sGoalId =
              oData?.GoalId;
          }

          // =========================
          // DIRECT ID STRING
          // =========================

          else if (typeof oEvent === "string") {

            sGoalId = oEvent;
          }

          // =========================
          // SECOND PARAMETER ID
          // =========================

          else if (id) {

            sGoalId = id;
          }

          // =========================
          // VALIDATION
          // =========================

          if (!sGoalId) {

            this.hideBusy();

            sap.m.MessageToast.show(
              "GoalId not found"
            );

            return;
          }

          // =========================
          // AJAX
          // =========================

          $.ajax({

            url:
              "https://rest.kalpavrikshatechnologies.com/GoalsAttachment?GoalId=" +
              sGoalId,

            method: "GET",

            headers: {

              "Content-Type":
                "application/json",

              name:
                "$2a$12$LC.eHGIEwcbEWhpi9gEA.umh8Psgnlva2aGfFlZLuMtPFjrMDwSui",

              password:
                "$2a$12$By8zKifvRcfxTbabZJ5ssOsheOLdAxA2p6/pdaNvv1xy1aHucPm0u"
            },

            success: function (result) {

              this.hideBusy();

              var attachment =
                result?.data?.[0];

              if (!attachment) {

                sap.m.MessageToast.show(
                  "No attachment found"
                );

                return;
              }

              this._openPdfFromBase64(

                attachment.AttachmentContent,

                attachment.AttachmentName

              );

            }.bind(this),

            error: function () {

              this.hideBusy();

              sap.m.MessageToast.show(
                "Failed to load attachment"
              );
            }

          });

        } catch (e) {

          this.hideBusy();

          sap.m.MessageToast.show(
            "Error opening attachment"
          );
        }
      },
      _openPdfFromBase64: function (pdfData, sFileName) {

        try {

          if (!pdfData) {

            sap.m.MessageToast.show(
              "Invalid PDF data"
            );

            return;
          }

          let blob;

          // =========================
          // BUFFER OBJECT
          // =========================

          if (

            typeof pdfData === "object" &&

            pdfData.type === "Buffer" &&

            Array.isArray(pdfData.data)

          ) {

            blob = new Blob(

              [new Uint8Array(pdfData.data)],

              {
                type: "application/pdf"
              }
            );
          }

          // =========================
          // ARRAY BUFFER
          // =========================

          else if (

            pdfData instanceof ArrayBuffer

          ) {

            blob = new Blob(

              [pdfData],

              {
                type: "application/pdf"
              }
            );
          }



          // =========================
          // BASE64 STRING
          // =========================

          else {

            let sBase64 = String(pdfData)

              .replace(
                /^data:application\/pdf;base64,/,
                ""
              )

              .replace(/\s/g, "");

            // =========================
            // HANDLE DOUBLE ENCODED PDF
            // =========================

            try {

              const firstDecode =
                atob(sBase64);

              // IF AGAIN STARTS WITH JVBER
              // THEN BACKEND DOUBLE ENCODED

              if (
                firstDecode.startsWith("JVBER")
              ) {

                sBase64 = firstDecode;
              }

            } catch (e) {

              console.log(
                "Normal Base64"
              );
            }

            // FIX PADDING

            while (
              sBase64.length % 4 !== 0
            ) {

              sBase64 += "=";
            }

            // BASE64 → BINARY

            const binary =
              atob(sBase64);

            const len =
              binary.length;

            const bytes =
              new Uint8Array(len);

            for (
              let i = 0;
              i < len;
              i++
            ) {

              bytes[i] =
                binary.charCodeAt(i);
            }

            // CREATE PDF BLOB

            blob = new Blob(

              [bytes],

              {
                type: "application/pdf"
              }
            );
          }

          // =========================
          // CREATE URL
          // =========================

          const pdfUrl =
            URL.createObjectURL(blob);

          // =========================
          // DIALOG
          // =========================

          if (!this._oPdfDialog) {

            this._oPdfDialog =
              new sap.m.Dialog({

                title:
                  sFileName ||
                  "PDF Preview",

                stretch:
                  sap.ui.Device.system.phone,

                contentWidth: "95%",

                contentHeight: "95%",

                draggable: true,

                resizable: true,

                horizontalScrolling: false,

                verticalScrolling: false,

                endButton:
                  new sap.m.Button({

                    text: "Close",

                    press: function () {

                      this._oPdfDialog.close();

                    }.bind(this)
                  })
              });

            this._oPdfDialog.addStyleClass(
              "sapUiNoContentPadding"
            );
          }

          // CLEAR CONTENT

          this._oPdfDialog.removeAllContent();

          // PDF VIEW

          this._oPdfDialog.addContent(

            new sap.ui.core.HTML({

              preferDOM: true,

              content: `

                    <iframe
                        src="${pdfUrl}"
                        style="
                            width:100%;
                            height:90vh;
                            border:none;
                        ">
                    </iframe>

                `
            })
          );

          this._oPdfDialog.open();

        } catch (e) {



          sap.m.MessageToast.show(
            "Failed to open PDF"
          );
        }
      },

      _handleAction: function (oEvent) {
        var params = oEvent.getParameter("parameters") || {};
        var method = params.method;
        var id = params.id;
        var card = this.getCard();
        var model = card.getModel();
        var data = model.getData();
        // ================= APPROVE / REJECT =================
        if (method === "approve" || method === "reject") {
          this._openApprovalDialog(method, id);
          return;
        }
        // ================= OPEN PDF =================
        if (method === "openPDF") {
          // =========================
          // VALIDATE GOAL ID
          // =========================
          if (!id) {
            sap.m.MessageToast.show(
              "GoalId not found"
            );
            return;
          }
          // =========================
          // IF PDF EXISTS IN CARD MODEL
          // =========================
          if (
            data &&
            data.AttachmentContent
          ) {
            this._openPdfFromBase64(
              data.AttachmentContent,
              data.AttachmentName
            );
            return;
          }
          // =========================
          // LOAD FROM API
          // =========================
          this._onPressAttachment(id);
          return;
        }
        if (!data || !data.GoalId) {
          sap.m.MessageToast.show("No valid goal selected");
          return;
        }
        // ================= EDIT SOLUTION =================
        if (method === "editSolution") {
          this._openSolutionDialog(id);
          return;
        }
        // Handle Submit
        if (method === "submit") {
          this._openSolutionDialog(id);
          return;
        }
        // ================= EDIT =================
        if (method === "edit") {
          this._openEditDialog(data);
          return;
        }
        // ================= VIEW DETAILS =================
        if (method === "viewDetails") {
          this._openViewDetailsDialog(data);
          return;
        }
        // ================= SAVE =================
        if (method === "save") {
          var oCard = this.getCard();
          var oTextArea = oCard.getDomRef().querySelector("textarea");
          var updatedDescription = oTextArea
            ? oTextArea.value
            : data.Description;
          var payload = {
            filters: {
              GoalId: data.GoalId,
            },
            data: {
              EmpID: data.EmpID,
              EmpName: data.EmpName,
              Topic: data.Topic,
              Quarter: data.Quarter,
              StartDate: data.StartDate,
              EndDate: data.EndDate,
              Description: updatedDescription,
              Status: "Pending",
              ScoresRemark: data.ScoresRemark || "",
              Score: data.Score || "0",
              HelpRequired: data.HelpRequired || "",
              SolutionDetails: data.SolutionDetails || "",
              CreatedDate: data.CreatedDate || data.StartDate,
            },
          };
          this.showBusy();
          $.ajax({
            url: "https://rest.kalpavrikshatechnologies.com/Goals",
            method: "PUT",
            data: JSON.stringify(payload),
            headers: {
              "Content-Type": "application/json",
              name: "$2a$12$LC.eHGIEwcbEWhpi9gEA.umh8Psgnlva2aGfFlZLuMtPFjrMDwSui",
              password:
                "$2a$12$By8zKifvRcfxTbabZJ5ssOsheOLdAxA2p6/pdaNvv1xy1aHucPm0u",
            },
            success: () => {
              this.hideBusy();
              data.Description = updatedDescription;
              data.editable1 = false;
              data.editable2 = true;
              this.getCard().getModel().refresh();
              MessageToast.show("Saved Successfully");
            },
            error: (err) => {
              this.hideBusy();
              MessageToast.show("Save Failed");
            },
          });
          return;
        }

        // ================= CANCEL =================
        if (method === "cancel") {
          data.editable1 = false;
          data.editable2 = true;
          model.refresh();
          MessageToast.show("Cancelled");
          return;
        }
      },
    });
  },
);