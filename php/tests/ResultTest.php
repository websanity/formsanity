<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Tests;

use PHPUnit\Framework\TestCase;
use WebSanity\FormSanity\Messages;
use WebSanity\FormSanity\Result;

final class ResultTest extends TestCase
{
	public function testAValidResultIsAccepted(): void
	{
		$result = new Result([]);
		self::assertTrue($result->isValid());
		self::assertSame([], $result->errors());
		self::assertSame(200, $result->httpStatus());
		self::assertSame(['formsanity' => 2, 'status' => 'accepted', 'message' => 'Thanks!'], $result->envelope('Thanks!'));
	}

	public function testAnInvalidResultListsItsErrors(): void
	{
		$error = ['field' => 'email', 'code' => 'required', 'message' => Messages::for('required')];
		$result = new Result([$error]);
		self::assertFalse($result->isValid());
		self::assertSame(422, $result->httpStatus());
		self::assertSame(['formsanity' => 2, 'status' => 'invalid', 'errors' => [$error]], $result->envelope());
	}

	public function testAHostCanAddAnExtensionError(): void
	{
		$result = (new Result([]))->withError(null, 'x-blocked', 'Submissions are paused.');
		self::assertFalse($result->isValid());
		self::assertSame([['field' => null, 'code' => 'x-blocked', 'message' => 'Submissions are paused.']], $result->errors());
		self::assertSame(422, $result->httpStatus());
	}

	public function testMessagesCoverTheRegistryAndNothingElse(): void
	{
		foreach (['required', 'type.email', 'type.native', 'badinput', 'pattern', 'minlength', 'maxlength', 'min', 'max', 'step', 'constraint', 'min-time', 'max-time', 'min-digits', 'min-uppercase', 'min-lowercase', 'group.required-any', 'group.required-together', 'min-selected', 'max-selected', 'file.max-size', 'file.accept', 'unique', 'group.unique-values', 'relevance'] as $code) {
			self::assertNotSame('', Messages::for($code), $code);
		}
		self::assertSame('', Messages::for('x-blocked'));
	}
}
