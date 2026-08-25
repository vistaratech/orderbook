export type RootStackParamList = {
  OnboardingWizard: undefined;
  Login: undefined;
  Register: undefined;
  MainTabs: undefined;
  OrderList: undefined;
  OrderForm: { orderId?: string; prefillCustomerName?: string; prefillPhone?: string } | undefined;
  OrderDetail: { orderId: string };
  ExpenseForm: { expenseId?: string } | undefined;
  CustomerList: undefined;
  CustomerDetail: { customerId: string };
  CustomerForm: { customerId?: string } | undefined;
  ProductList: undefined;
  ProductForm: { productId?: string } | undefined;
  Settings: undefined;
};

export type MainTabParamList = {
  DashboardTab: undefined;
  OrdersTab: undefined;
  ExpensesTab: undefined;
  ReportsTab: undefined;
  MoreTab: undefined;
};
