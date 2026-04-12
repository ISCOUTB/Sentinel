resource "aws_lambda_function" "connect" {
  function_name = "${var.project_name}-ws-connect"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "connect.handler"
  runtime       = "nodejs18.x"

  filename         = "${path.module}/lambdas/connect.zip"
  source_code_hash = filebase64sha256("${path.module}/lambdas/connect.zip")
}

resource "aws_lambda_function" "disconnect" {
  function_name = "${var.project_name}-ws-disconnect"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "disconnect.handler"
  runtime       = "nodejs18.x"

  filename         = "${path.module}/lambdas/disconnect.zip"
  source_code_hash = filebase64sha256("${path.module}/lambdas/disconnect.zip")
}

resource "aws_lambda_function" "default" {
  function_name = "${var.project_name}-ws-default"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "default.handler"
  runtime       = "nodejs18.x"

  filename         = "${path.module}/lambdas/default.zip"
  source_code_hash = filebase64sha256("${path.module}/lambdas/default.zip")
}