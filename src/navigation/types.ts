export type RootStackParamList = {
  OnboardingWizard: undefined;
  Login: { initialTab?: 'login' | 'register' } | undefined;
  Register: { initialTab?: 'login' | 'register' } | undefined;
  MainTabs: undefined;
  OrderList: undefined;
  OrderForm: { orderId?: string; prefillCustomerName?: string; prefillPhone?: string; fromEstimateId?: string } | undefined;
  OrderDetail: { orderId: string };
  ExpenseForm: { expenseId?: string } | undefined;
  CustomerList: undefined;
  CustomerDetail: { customerId: string };
  CustomerForm: { customerId?: string } | undefined;
  ProductList: undefined;
  ProductForm: { productId?: string } | undefined;
  Settings: undefined;
  BusinessProfile: undefined;
  History: undefined;
  ResetPassword: { oobCode?: string } | undefined;
  PurchaseList: undefined;
  PurchaseForm: { purchaseId?: string } | undefined;
  EstimateList: undefined;
  EstimateForm: { estimateId?: string } | undefined;
  EstimateDetail: { estimateId: string };
  InvoiceTemplateCustomizer: undefined;
};

export type MainTabParamList = {
  DashboardTab: undefined;
  OrdersTab: undefined;
  ExpensesTab: undefined;
  ReportsTab: undefined;
  MoreTab: undefined;
};

