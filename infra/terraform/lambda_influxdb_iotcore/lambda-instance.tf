# IAM Role for Lambda
resource "aws_iam_role" "lambda_exec" {
  name = "${var.lambda_name}_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}


# Prepare Deployment Package (Install dependencies and copy code)
resource "null_resource" "prepare_package" {
  triggers = {
    requirements = filemd5("${path.module}/src/requirements.txt")
    source_code  = filemd5("${path.module}/src/lambda_function.py")
  }

  provisioner "local-exec" {
    command = <<EOT
      mkdir -p ${path.module}/package
      python3 -m pip install -r ${path.module}/src/requirements.txt -t ${path.module}/package --upgrade
      cp ${path.module}/src/lambda_function.py ${path.module}/package/
    EOT
  }
}

data "archive_file" "lambda_final_zip" {
  type        = "zip"
  source_dir  = "${path.module}/package"
  output_path = "${path.module}/lambda_function.zip"

  depends_on = [null_resource.prepare_package]
}


# Lambda Function
resource "aws_lambda_function" "iot_influx_lambda" {
  filename         = data.archive_file.lambda_final_zip.output_path
  function_name    = var.lambda_name
  role             = aws_iam_role.lambda_exec.arn
  handler          = "lambda_function.lambda_handler"
  source_code_hash = data.archive_file.lambda_final_zip.output_base64sha256
  runtime          = "python3.11"
  timeout          = 30

  environment {
    variables = {
      INFLUXDB_URL      = var.influxdb_url
      INFLUXDB_BUCKET   = var.influxdb_bucket
      INFLUXDB_ORG      = var.influxdb_org
      INFLUXDB_USERNAME = var.influxdb_username
      INFLUXDB_PASSWORD = var.influxdb_password
    }
  }
}
