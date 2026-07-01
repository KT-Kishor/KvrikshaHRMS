sap.ui.define(
  ["./BaseController", "sap/ui/model/json/JSONModel", "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"],
  function (BaseController, JSONModel, Filter, FilterOperator) {
    "use strict";
    return BaseController.extend(
      "sap.kt.com.minihrsolution.controller.HiringDashboardOverview",
      {
        onInit: function () {
          this.getRouter()
            .getRoute("RouteHiringDashboardOverview")
            .attachMatched(this._onRouteMatched, this);
          this._iPage = 1;
          this._iLimit = 10;
          this._bLoading = false;
        },

        loadCandidates: async function (bAppend) {
          if (this._bLoading) {
            return;
          }
          this._bLoading = true;
          try {
            var oResponse = await this.ajaxCreateWithJQuery(
              "getDashboardCandidates",
              { page: this._iPage, limit: this._iLimit }
            );
            var aNewData = oResponse.data || [];
            aNewData.forEach(function (oCandidate) {
              if (oCandidate.submittedDate) {
                oCandidate.submittedDate =
                  new Date(oCandidate.submittedDate).toLocaleDateString("en-GB");
              }
            });
            var oModel = this.getView().getModel("CandidateModel");
            if (!bAppend) {
              oModel = new JSONModel({
                Candidates: aNewData,
                Count: oResponse.pagination.total,
                FilteredCount: oResponse.pagination.total
              });
              this.getView().setModel(oModel, "CandidateModel");
            } else {
              var aExisting = oModel.getProperty("/Candidates") || [];
              oModel.setProperty("/Candidates", aExisting.concat(aNewData));
              oModel.setProperty(
    "/FilteredCount",
    oModel.getProperty("/Candidates").length
);
            }
          } catch (e) {
            console.error(e);
          } finally {
            this._bLoading = false;
          }
        },

        HD_onPressPassFailPie: function () {
  this.getView().getModel("ChartTypeModel").setProperty("/passFailType", "pie");
},
HD_onPressPassFailDonut: function () {
  this.getView().getModel("ChartTypeModel").setProperty("/passFailType", "donut");
},
HD_onPressPassFailBar: function () {
  this.getView().getModel("ChartTypeModel").setProperty("/passFailType", "bar");
},

HD_onPressSkillColumn: function () {
  this.getView().getModel("ChartTypeModel").setProperty("/skillLevelType", "column");
},
HD_onPressSkillBar: function () {
  this.getView().getModel("ChartTypeModel").setProperty("/skillLevelType", "bar");
},

HD_onPressTestLine: function () {
  this.getView().getModel("ChartTypeModel").setProperty("/testCompletedType", "line");
},
HD_onPressTestColumn: function () {
  this.getView().getModel("ChartTypeModel").setProperty("/testCompletedType", "column");
},

HD_onPressMcqCodingDonut: function () {
  this.getView().getModel("ChartTypeModel").setProperty("/mcqCodingType", "donut");
},
HD_onPressMcqCodingPie: function () {
  this.getView().getModel("ChartTypeModel").setProperty("/mcqCodingType", "pie");
},

        onTableUpdateFinished: async function () {
          var oModel = this.getView().getModel("CandidateModel");
          if (!oModel) return;
          var iTotal = oModel.getProperty("/Count");
          var aCandidates = oModel.getProperty("/Candidates") || [];
          var iCurrent = aCandidates.length;
          if (iCurrent < iTotal && !this._bLoading) {
            this._iPage++;
            await this.loadCandidates(true);
          }
        },

      _onRouteMatched: async function () {
    const isValid = await this.commonLoginFunction("Expense");
    if (!isValid) return;

    this.getBusyDialog();

    try {
        var oSummaryResponse = await this.ajaxCreateWithJQuery(
            "getDashboardSummary", {}
        );

        var oChartResponse = await this.ajaxCreateWithJQuery(
            "getDashboardCharts", {}
        );

        var oDashboardData = oSummaryResponse?.data || oSummaryResponse || {};
        this.getView().setModel(
            new JSONModel(oDashboardData),
            "DashboardModel"
        );

        this._iPage = 1;
        await this.loadCandidates(false);

        var oCharts = oChartResponse.data;

        this.getView().setModel(
            new JSONModel({
                PassFail: [
                    {
                        Result: "Pass",
                        Count: oCharts.passFailPie.pass
                    },
                    {
                        Result: "Fail",
                        Count: oCharts.passFailPie.fail
                    },
                    {
                        Result: "In Progress",
                        Count: oCharts.passFailPie.inProgress
                    },
                    {
                        Result: "Not Started",
                        Count: oCharts.passFailPie.notStarted
                    }
                ],

                SkillLevel: oCharts.skillLevelBar.map(function (item) {
                    return {
                        Skill: item.label,
                        Count: item.total
                    };
                }),

                TestCompleted: oCharts.testsOverTime.map(function (item) {
                    return {
                        Day: item.date,
                        Count: item.mcqCompleted + item.codingCompleted
                    };
                }),

                McqCoding: [
                    {
                        Type: "MCQ Submitted",
                        Count: oCharts.mcqVsCodingDonut.mcqSubmitted
                    },
                    {
                        Type: "MCQ Pending",
                        Count: oCharts.mcqVsCodingDonut.mcqPending
                    },
                    {
                        Type: "Coding Submitted",
                        Count: oCharts.mcqVsCodingDonut.codingSubmitted
                    },
                    {
                        Type: "Coding Pending",
                        Count: oCharts.mcqVsCodingDonut.codingPending
                    }
                ]
            }),
            "ChartModel"
        );

        // Chart Type Model
        this.getView().setModel(
            new JSONModel({
                passFailType: "pie",
                skillLevelType: "column",
                testCompletedType: "line",
                mcqCodingType: "donut"
            }),
            "ChartTypeModel"
        );

    } catch (oError) {
        console.error(oError);
    } finally {
        this.closeBusyDialog();
    }
},

        onViewCandidate: async function (oEvent) {
          var oContext = oEvent
            .getSource()
            .getParent()
            .getBindingContext("CandidateModel");
          var oSelectedData = oContext.getObject();
          this.getBusyDialog();
          try {
            var oDetailResponse = await this.ajaxCreateWithJQuery(
              "getCandidateDetail",
              { id: oSelectedData.id }
            );

            if (this._oStudentDialog) {
              this._oStudentDialog.destroy();
              this._oStudentDialog = null;
            }

            this._oStudentDialog = await this.loadFragment({
              name: "sap.kt.com.minihrsolution.fragment.StudentDetails",
            });

            this.getView().addDependent(this._oStudentDialog);

            var d = oDetailResponse?.data || oDetailResponse || {};
            var mcq = d.mcqTest || {};
            var coding = d.codingTest || {};

            // ── FIX: map questionBreakdown — deduplicate by question_id
            // keeping only the first occurrence of each unique question
            var aRaw = mcq.questionBreakdown || [];
            var oSeen = {};
            var aQuestions = [];
            aRaw.forEach(function (oQ) {
              var sKey = String(oQ.question_id);
              if (!oSeen[sKey]) {
                oSeen[sKey] = true;
                aQuestions.push({
                  order_no: oQ.order_no,
                  question_id: oQ.question_id,
                  question_text: oQ.question_text || "",
                  marks: oQ.marks ?? 1,
                  selected_option_text: oQ.selected_option_text || "",
                  correct_option_text: oQ.correct_option_text || "",
                  marks_awarded: oQ.marks_awarded ?? 0,
                  status: oQ.status || "Skipped",
                });
              }
            });

            var oModel = new JSONModel({
              // ── Candidate fields ──────────────────────────
              id: d.candidate?.id || "",
              student_Id: d.candidate?.student_Id || "",
              candidate_Name: d.candidate?.candidate_Name || "",
              candidate_Email: d.candidate?.candidate_Email || "",
              skill_level: d.candidate?.skill_level || "",
              preferred_language: d.candidate?.preferred_language || "",
              photo: d.candidate?.photo || "",
              created_at: d.candidate?.created_at
                ? new Date(d.candidate.created_at).toLocaleString()
                : "",

              // ── MCQ fields ────────────────────────────────
              mcqScore: mcq.score ?? 0,
              mcqStatus: mcq.status || "Not Started",
              mcqResult: mcq.result_status || "Result Pending",
              mcqTotalMarks: mcq.total_marks ?? 0,
              mcqTimeTaken: mcq.timeTakenMins ?? 0,
              mcqStartedAt: mcq.started_at
                ? new Date(mcq.started_at).toLocaleString()
                : "Test Not Started",
              mcqSubmittedAt: mcq.submitted_at
                ? new Date(mcq.submitted_at).toLocaleString()
                : "Not Submitted",
              totalQuestions: mcq.totalQuestions ?? 0,
              correctAnswers: mcq.correctAnswers ?? 0,
              wrongAnswers: mcq.incorrectAnswers ?? 0,

              // ── FIX: question breakdown array added to model ──
              questionBreakdown: aQuestions,

              // ── Coding fields ─────────────────────────────
              codingScore: coding.score ?? 0,
              codingStatus: coding.status || "Not Started",
              codingResult: coding.result_status || "Result Pending",
              codingTotalMarks: coding.total_marks ?? 0,
              codingTimeTaken: coding.timeTakenMins ?? 0,
              codingStartedAt: coding.started_at
                ? new Date(coding.started_at).toLocaleString()
                : "Coding Test Not Started",
              codingSubmittedAt: coding.submitted_at
                ? new Date(coding.submitted_at).toLocaleString()
                : "Code Not Submitted",
              submittedLanguage:
                coding.submittedLanguage ||
                d.candidate?.preferred_language ||
                "Language Not Specified",
              aiScore: coding.ai_score ?? 0,

              codingSubmissions: (coding.submissions || []).map(function (s, i) {
                return {
                  index: i + 1,
                  answer_id: s.answer_id,
                  question_id: s.question_id,
                  submittedLanguage: s.submittedLanguage || "Language Not Specified ",
                  submittedCode: s.submittedCode || "No code submitted yet.",
                  ai_score: s.ai_score ?? 0,
                  detailedFeedback: s.detailedFeedback || "",
                };
              }),

              // ── Overall ───────────────────────────────────
              overallScore: d.overallScore ?? 0,
              overallResult: d.overallResult || "In Progress",
              totalMarks: (mcq.total_marks ?? 0) + (coding.total_marks ?? 0),
            });

            // ── FIX: set size limit so all questions render (default JSONModel limit is 100)
            oModel.setSizeLimit(10000);

            this._oStudentDialog.setModel(oModel, "studentModel");
            this._oStudentDialog.open();
          } catch (oError) {
            console.error(oError);
          } finally {
            this.closeBusyDialog();
          }
        },

        onMcqFilterChange: function (oEvent) {
          var sKey = oEvent.getParameter("item").getKey();

          // Find the Table inside the dialog by iterating its content
          var oTable = null;
          var oCountText = null;

          if (this._oStudentDialog) {
            this._oStudentDialog.getContent()[0]
              .findAggregatedObjects(true, function (oControl) {
                if (
                  oControl.isA("sap.m.Table") &&
                  oControl.getId().endsWith("mcqBreakdownTable")
                ) {
                  oTable = oControl;
                }
                if (
                  oControl.isA("sap.m.Text") &&
                  oControl.getId().endsWith("mcqFilterCount")
                ) {
                  oCountText = oControl;
                }
              });
          }

          if (!oTable) {
            console.warn("mcqBreakdownTable not found in dialog");
            return;
          }

          var oBinding = oTable.getBinding("items");

          if (sKey === "All") {
            oBinding.filter([]);
          } else {
            oBinding.filter([
              new Filter("status", FilterOperator.EQ, sKey)
            ]);
          }

          if (oCountText) {
            // getLength() after filter returns filtered count
            var iCount = oBinding.getLength();
            oCountText.setText(iCount + " question" + (iCount !== 1 ? "s" : ""));
          }
        },

     onCandidateLiveSearch: function (oEvent) {
    var sValue = (oEvent.getParameter("newValue") || "")
        .toLowerCase()
        .trim();

    var oTable = this.byId("HDO_id_CandidateTable");
    var oBinding = oTable.getBinding("items");
    var oModel = this.getView().getModel("CandidateModel");

    if (!sValue) {
        oBinding.filter([]);

        var iTotal = oModel.getProperty("/Candidates").length;
        oModel.setProperty("/FilteredCount", iTotal);

        return;
    }

    var oFilter = new Filter({
        path: "",
        test: function (oData) {
            return (
                String(oData.student_Id || "")
                    .toLowerCase()
                    .includes(sValue) ||

                String(oData.candidate_Name || "")
                    .toLowerCase()
                    .includes(sValue) ||

                String(oData.candidate_Email || "")
                    .toLowerCase()
                    .includes(sValue) ||
                String(oData.overallResult || "")
                    .toLowerCase()
                    .includes(sValue) 
            );
        }
    });

    oBinding.filter([oFilter]);

    setTimeout(function () {
        oModel.setProperty(
            "/FilteredCount",
            oBinding.getLength()
        );
    }, 0);
},

        onCloseStudentDialog: function () {
          if (this._oStudentDialog) {
            this._oStudentDialog.close();
          }
        },

        HDO_onPress: function () {
          this.getRouter().navTo("RouteHiringDashboard");
        },

        onLogout: function () {
          this.CommonLogoutFunction();
        },
      }
    );
  }
);  